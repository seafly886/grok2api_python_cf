module.exports = {
  env: {
    browser: true,
    es2021: true,
    worker: true,
    node: true
  },
  extends: [
    'eslint:recommended'
  ],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module'
  },
  globals: {
    // Cloudflare Workers globals
    addEventListener: 'readonly',
    Response: 'readonly',
    Request: 'readonly',
    fetch: 'readonly',
    crypto: 'readonly',
    btoa: 'readonly',
    atob: 'readonly',
    TextEncoder: 'readonly',
    TextDecoder: 'readonly',
    ReadableStream: 'readonly',
    WritableStream: 'readonly',
    TransformStream: 'readonly',
    URL: 'readonly',
    URLSearchParams: 'readonly',
    FormData: 'readonly',
    Headers: 'readonly',
    Blob: 'readonly',
    File: 'readonly'
  },
  rules: {
    // 基础规则
    'no-console': 'off', // 允许 console.log 用于调试
    'no-unused-vars': ['error', { 'argsIgnorePattern': '^_' }],
    'no-undef': 'error',
    'no-redeclare': 'error',
    'no-unreachable': 'error',
    
    // 代码风格
    'indent': ['error', 2],
    'quotes': ['error', 'single'],
    'semi': ['error', 'always'],
    'comma-dangle': ['error', 'never'],
    'object-curly-spacing': ['error', 'always'],
    'array-bracket-spacing': ['error', 'never'],
    
    // 最佳实践
    'eqeqeq': ['error', 'always'],
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'no-new-func': 'error',
    'no-script-url': 'error',
    'no-self-compare': 'error',
    'no-sequences': 'error',
    'no-throw-literal': 'error',
    'no-void': 'error',
    'no-with': 'error',
    'radix': 'error',
    'wrap-iife': ['error', 'inside'],
    
    // ES6+
    'arrow-spacing': 'error',
    'no-duplicate-imports': 'error',
    'no-var': 'error',
    'prefer-const': 'error',
    'prefer-arrow-callback': 'error',
    'prefer-template': 'error'
  }
};
