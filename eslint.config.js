import js from '@eslint/js';

export default [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        // Browser globals
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        console: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        fetch: 'readonly',
        WebSocket: 'readonly',
        setTimeout: 'readonly',
        setInterval: 'readonly',
        clearTimeout: 'readonly',
        clearInterval: 'readonly',
        requestAnimationFrame: 'readonly',
        cancelAnimationFrame: 'readonly',
        performance: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        Blob: 'readonly',
        Audio: 'readonly',
        MediaRecorder: 'readonly',
        FormData: 'readonly',
        TextDecoder: 'readonly',
        TextEncoder: 'readonly',
        AbortController: 'readonly',
        CustomEvent: 'readonly',
        MouseEvent: 'readonly',
        EventTarget: 'readonly',
        Element: 'readonly',
        customElements: 'readonly',
        getComputedStyle: 'readonly',
        alert: 'readonly',
        SpeechSynthesisUtterance: 'readonly',
        MutationObserver: 'readonly',
        PerformanceObserver: 'readonly',
        // Service Worker globals
        self: 'readonly',
        caches: 'readonly',
        // Node.js globals
        process: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        require: 'readonly',
        module: 'readonly',
        exports: 'readonly',
        Buffer: 'readonly',
        global: 'readonly'
      }
    },
    rules: {
      'indent': ['warn', 2],
      'quotes': ['warn', 'single', { allowTemplateLiterals: true }],
      'semi': ['warn', 'always'],
      'no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_'
      }],
      'no-console': 'off',
      'no-undef': 'warn',
      'prefer-const': 'warn',
      'no-var': 'warn',
      'arrow-spacing': 'warn',
      'comma-dangle': ['warn', 'never'],
      'object-curly-spacing': ['warn', 'always'],
      'array-bracket-spacing': ['warn', 'never'],
      'space-before-function-paren': ['warn', {
        anonymous: 'never',
        named: 'never',
        asyncArrow: 'always'
      }],
      'keyword-spacing': 'warn',
      'space-infix-ops': 'warn',
      'eol-last': ['warn', 'always'],
      'no-trailing-spaces': 'warn',
      'no-multiple-empty-lines': ['warn', { max: 2, maxEOF: 1 }]
    }
  },
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'build/**',
      '**/venv/**',
      '**/.venv/**',
      '**/*.min.js',
      'third_party/**',
      'data/**',
      'models/**',
      'logs/**',
      'goose/**',
      '*.pyc',
      '**/__pycache__/**',
      '**/site-packages/**'
    ]
  }
];
