const { join } = require('path');
module.exports = {
    parser: '@typescript-eslint/parser',
    parserOptions: {
        ecmaVersion: 2022,
        project: join(__dirname, './tsconfig.lib.json'),
        sourceType: 'module',
    },
    plugins: ['@typescript-eslint/eslint-plugin', 'etc'],
    extends: ['../.eslintrc.json', 'plugin:@typescript-eslint/recommended'],
    root: false,
    env: {
        node: true,
    },
    ignorePatterns: ['.eslintrc.js', 'node_modules/', 'jest.config.js', '*.test.ts', '*.spec.ts'],
    rules: {
        // Off because it's a dumb rule.
        '@typescript-eslint/interface-name-prefix': 'off',
        // Need this off since we use it until I have a better idea what the types should be.
        '@typescript-eslint/no-explicit-any': 'off',
        // Need this off since we place @ts-ignore in places.
        '@typescript-eslint/ban-ts-comment': 'off',
        // Need this off since we force using ! everywhere.
        '@typescript-eslint/no-non-null-assertion': 'off',
        // Ignore unused vars if they start with _.
        '@typescript-eslint/no-unused-vars': [
            'warn',
            {
                argsIgnorePattern: '^_',
                varsIgnorePattern: '^_',
            },
        ],

        // Exported const enums are problematic for libary usage
        'etc/no-const-enum': [
            'error',
            {
                allowLocal: true,
            },
        ],
        // Prettier too dumb to understand that auto-crlf exists in git
        'prettier/prettier': [
            'error',
            {
                endOfLine: 'auto',
            },
        ],
        'no-constant-condition': [
            'error',
            {
                checkLoops: false,
            },
        ],
    },
};
