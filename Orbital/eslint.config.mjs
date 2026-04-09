import globals from 'globals';

export default [
  {
    files: ['src/js/**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'script',
      globals: {
        ...globals.browser,
        ...globals.node
      }
    },
    rules: {
      'no-console': 'off',
      'no-unused-vars': [
        'warn',
        { vars: 'all', args: 'none', ignoreRestSiblings: true }
      ],
      'prefer-const': ['warn', { destructuring: 'all' }]
    }
  }
];
