"""
Simple HiFi-GAN / ParallelWaveGAN inference wrapper.

Usage (after installing dependencies):

pip install git+https://github.com/jik876/hifi-gan.git
# or
pip install parallelwavegan

Example:
python -m ukrainian_tts.vocoder.infer \
  --mel path/to/mel.npy \
  --out out.wav \
  --checkpoint path/to/hifigan.pth

This script is intentionally minimal: it loads mel from a numpy file
and writes wav using soundfile. It supports two backends (hifigan, pwgan)
based on availability.
"""
import argparse
import numpy as np
import importlib
import importlib.util
import soundfile as sf
from typing import Any, Optional

# Compatibility shim: some versions of scipy expose the kaiser window at
# scipy.signal.older locations; parallel_wavegan imports `from scipy.signal import kaiser`
# which can fail on newer SciPy. If kaiser is missing, expose it from
# scipy.signal.windows so downstream imports succeed.
try:
    import scipy.signal as _scipy_signal
    if not hasattr(_scipy_signal, 'kaiser'):
        try:
            import scipy.signal.windows as _scipy_windows
            setattr(_scipy_signal, 'kaiser', _scipy_windows.kaiser)
        except Exception:
            # leave it; import error will surface later with clearer message
            pass
except Exception:
    # scipy may not be installed yet; the caller will get a clearer error
    pass


def _try_import_hifigan() -> bool:
    return importlib.util.find_spec("hifigan") is not None


def _try_import_pwgan():
    return importlib.util.find_spec("parallel_wavegan") is not None


def infer_hifigan(mel, checkpoint, out_path, sr=22050):
    # Minimal example using the hifigan repo API
    try:
        import torch
        hifigan_models = importlib.import_module("hifigan")
    except ModuleNotFoundError as exc:
        raise RuntimeError("HiFi-GAN not available. Install with: pip install git+https://github.com/jik876/hifi-gan.git")
    except Exception as exc:
        raise RuntimeError("Failed to import HiFi-GAN modules") from exc

    generator_cls: Optional[Any] = getattr(hifigan_models, "Generator", None)
    if generator_cls is None:
        try:
            hifigan_models = importlib.import_module("hifigan.models")
            generator_cls = getattr(hifigan_models, "Generator")
        except Exception as exc:
            raise RuntimeError("HiFi-GAN Generator class not found. Ensure the repository installation is complete.") from exc

    if generator_cls is None:
        raise RuntimeError("HiFi-GAN Generator class still missing after import attempts.")

    device = torch.device('cpu')
    model = generator_cls()  # type: ignore[call-arg]
    state = torch.load(checkpoint, map_location=device)
    model.load_state_dict(state['generator'])
    model.to(device).eval()

    with torch.no_grad():
        m = torch.from_numpy(mel).unsqueeze(0)
        wav = model(m).squeeze().cpu().numpy()
    sf.write(out_path, wav, sr)


def infer_pwgan(mel, checkpoint, out_path, sr=22050):
    try:
        importlib.import_module("parallel_wavegan")
        torch = importlib.import_module("torch")
    except ModuleNotFoundError as exc:
        raise RuntimeError(
            "ParallelWaveGAN not available. Install with: pip install parallel-wavegan"
        ) from exc

    # Manually construct model from the config next to the checkpoint for robustness
    import os
    checkpoint = os.path.abspath(checkpoint)
    ck_dir = os.path.abspath(os.path.dirname(checkpoint))
    cfg_path = os.path.join(ck_dir, 'config.yml')
    stats_path = os.path.join(ck_dir, 'stats.h5')
    if not os.path.exists(cfg_path):
        raise FileNotFoundError(f"Missing config.yml next to checkpoint: looked in {ck_dir} -> {os.listdir(ck_dir)}")
    import yaml
    with open(cfg_path, 'r') as f:
        cfg_dict = yaml.load(f, Loader=yaml.Loader)

    # Type guard: cfg_dict should be a dict, not a list
    if not isinstance(cfg_dict, dict):
        raise TypeError(f"Expected config to be a dict, got {type(cfg_dict)}")

    # instantiate model class from parallel_wavegan.models
    try:
        pw_models = importlib.import_module("parallel_wavegan.models")
    except ModuleNotFoundError as exc:
        raise RuntimeError(
            "ParallelWaveGAN models submodule missing. Ensure parallel-wavegan is installed"
        ) from exc
    generator_type = cfg_dict.get('generator_type', 'ParallelWaveGANGenerator')
    model_class = getattr(pw_models, generator_type)
    generator_params_raw = cfg_dict.get('generator_params', {})
    if not isinstance(generator_params_raw, dict):
        raise TypeError(f"Expected generator_params to be a dict, got {type(generator_params_raw)}")
    generator_params = {k.replace('upsample_kernal_sizes', 'upsample_kernel_sizes'): v for k, v in generator_params_raw.items()}
    import torch as _torch
    model = model_class(**generator_params)

    ck = _torch.load(checkpoint, map_location='cpu')
    try:
        state_dict = ck['model']['generator']
    except Exception:
        state_dict = ck.get('generator', ck.get('state_dict', ck))
    model.load_state_dict(state_dict)

    if os.path.exists(stats_path):
        try:
            model.register_stats(stats_path)
        except Exception:
            pass

    vocoder = model
    try:
        vocoder.remove_weight_norm()
    except Exception:
        pass
    vocoder.eval()
    with torch.no_grad():
        import torch as _torch
        # Prepare mel tensor robustly: ensure float32, contiguous, correct shape
        m = _torch.from_numpy(mel)
        if m.dtype != _torch.float32:
            m = m.to(_torch.float32)
        # Expected shape for ParallelWaveGAN: (B, C, T) where C == n_mels
        if m.dim() == 2:
            m = m.unsqueeze(0)
        # If shape looks like (B, T, C) (time dimension before channel), permute to (B, C, T)
        if m.dim() == 3 and m.shape[1] > m.shape[2]:
            # Heuristic: if the first non-batch dim is larger than the second,
            # it's likely (B, T, C) so swap to (B, C, T)
            m = m.permute(0, 2, 1)
        m = m.contiguous()

        # Force CPU execution to avoid MPS/CUDA opcode mismatches for pad operations
        try:
            m = m.to('cpu')
            vocoder = vocoder.to('cpu')
        except Exception:
            pass

        # Log shapes/dtypes to aid debugging
        try:
            print('DEBUG vocoder input shape, dtype:', tuple(m.shape), m.dtype)
        except Exception:
            pass

        # Try inference; if a NotImplementedError about padding occurs, attempt
        # a simple fallback: add a batch/time-padding dimension or transpose.
        try:
            wav = vocoder.inference(m).squeeze().cpu().numpy()
        except NotImplementedError as e:
            print('Vocoder inference raised NotImplementedError:', e)
            # Attempt fallback: ensure 4D by unsqueezing channel dim (some models expect extra dims)
            try:
                mm = m.unsqueeze(-1) if m.dim() == 3 else m
                print('DEBUG attempting fallback with shape', tuple(mm.shape))
                wav = vocoder.inference(mm).squeeze().cpu().numpy()
            except Exception:
                # re-raise original error for visibility
                raise
    sf.write(out_path, wav, sr)


def infer_griffin(mel, out_path, sr=22050, n_fft=1024, hop_length=256, n_iter=60):
    """
    Simple Griffin-Lim fallback that converts a log-mel spectrogram back to
    waveform using librosa's mel_to_audio. This is lower quality but requires
    no external neural vocoder packages and is useful as a robust fallback.
    """
    try:
        import librosa
    except Exception:
        raise RuntimeError('librosa is required for Griffin-Lim fallback (pip install librosa)')

    # mel is expected to be log(mel_power); invert the log
    mel_lin = np.exp(mel)

    # librosa expects shape (n_mels, T) and power spectrogram
    # Use librosa.feature.inverse.mel_to_audio which runs Griffin-Lim internally
    wav = librosa.feature.inverse.mel_to_audio(mel_lin, sr=sr, n_fft=n_fft, hop_length=hop_length, power=1.0, n_iter=n_iter)
    sf.write(out_path, wav, sr)


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--mel', required=True)
    p.add_argument('--checkpoint', required=True)
    p.add_argument('--out', required=True)
    p.add_argument('--sr', type=int, default=22050)
    p.add_argument('--method', choices=['auto', 'hifigan', 'pwgan', 'griffin'], default='auto',
                   help='Which vocoder backend to use. auto will pick an available backend (default: auto)')
    args = p.parse_args()

    mel = np.load(args.mel)

    method = args.method
    if method == 'auto':
        if _try_import_hifigan():
            method = 'hifigan'
        elif _try_import_pwgan():
            method = 'pwgan'
        else:
            method = 'griffin'

    if method == 'hifigan':
        infer_hifigan(mel, args.checkpoint, args.out, sr=args.sr)
        return
    if method == 'pwgan':
        infer_pwgan(mel, args.checkpoint, args.out, sr=args.sr)
        return
    if method == 'griffin':
        # checkpoint is ignored for griffin but keep argument for compatibility
        infer_griffin(mel, args.out, sr=args.sr)
        return

    raise RuntimeError(f'Unsupported vocoder method: {method}')


if __name__ == '__main__':
    main()
