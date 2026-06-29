import neostandard, { plugins } from 'newneostandard'

const tseslint = plugins['typescript-eslint']

export default [
    ...neostandard({
        ts: true,
        ignores: [
            'lib.es5.d.ts',
            'dist/**',
            'public/**',
            'test/*.js',
            'bin/*.js',
            'docs/**'
        ]
    }),
    ...tseslint.configs.recommended,
    {
        rules: {
            '@typescript-eslint/no-unused-expressions': 'off',
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/consistent-type-imports': ['error', {
                prefer: 'type-imports'
            }],
            '@typescript-eslint/no-unused-vars': ['error', {
                argsIgnorePattern: '^_',
                varsIgnorePattern: '^_',
                caughtErrorsIgnorePattern: '^_'
            }],
            '@stylistic/key-spacing': 'off',
            '@stylistic/operator-linebreak': ['off'],
            '@stylistic/multiline-ternary': 'off',
            '@stylistic/no-multiple-empty-lines': ['error', {
                max: 1,
                maxEOF: 1
            }],
            '@stylistic/indent': ['error', 4, {
                SwitchCase: 1,
                ignoredNodes: [
                    'TemplateLiteral *',
                    'TSMappedType *',
                    'TSTypeParameterDeclaration *'
                ]
            }],
            '@stylistic/comma-dangle': 'off',
            '@stylistic/space-infix-ops': ['error', {
                ignoreTypes: true
            }],
            '@stylistic/no-multi-spaces': ['error', {
                ignoreEOLComments: true
            }]
        }
    }
]
