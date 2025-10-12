"""Fallback implementation of the ukrainian_accentor API.

The original ukrainian_accentor package is not published on PyPI,
so we provide a lightweight substitute that mimics the ``process``
function relied upon by ``ukrainian_tts.stress``. The implementation
uses ``ukrainian_word_stress`` underneath, which is already part of
the project dependencies.

This module is intentionally small – it only implements the subset
of functionality that ATLAS needs (``process`` with ``mode="plus"``).
If the upstream package becomes available again, simply remove this
module and install the official distribution instead.
"""
from __future__ import annotations

from typing import Callable

try:  # pragma: no cover - best effort optional dependency
    from ukrainian_word_stress import Stressifier, StressSymbol
except Exception as exc:  # pragma: no cover
    raise ImportError(
        "ukrainian_word_stress is required for the fallback ukrainian_accentor"
    ) from exc

_stressifier = Stressifier(stress_symbol=StressSymbol.CombiningAcuteAccent)


def _shift_plus_markers(text: str, marker: str = "+") -> str:
    """Mirror the shift logic used in ``ukrainian_tts.stress``.

    The source implementation moves each ``marker`` one character to the
    left (e.g. ``"приві+т"`` becomes ``"прив+іт"``). We reproduce that
    behaviour here so the fallback is a drop-in replacement.
    """
    if marker not in text:
        return text

    new_text = ""
    start = 0
    last = 0
    while True:
        pos = text.find(marker, start)
        if pos != -1:
            new_text += text[last : pos - 1] + marker + text[pos - 1]
            start = pos + 1
            last = start
        else:
            new_text += text[last:]
            break
    return new_text


def process(text: str, mode: str = "plus", *, _shift_fn: Callable[[str], str] | None = None) -> str:
    """Return ``text`` with stress markers.

    Parameters
    ----------
    text:
        Input text that needs stress marks.
    mode:
        Only ``"plus"`` is supported. Other modes are returned unchanged.
    _shift_fn:
        Internal hook for tests; allows swapping the shifting algorithm.
    """
    if not text:
        return text

    stressed = _stressifier(text)
    if mode != "plus":
        return stressed

    shifted = stressed.replace(StressSymbol.CombiningAcuteAccent, "+")
    shift = _shift_fn or _shift_plus_markers
    return shift(shifted)


__all__ = ["process"]
