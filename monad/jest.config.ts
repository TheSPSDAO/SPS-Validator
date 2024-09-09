/* eslint-disable */
export default {
    displayName: 'lib-monad',
    preset: '../jest.preset.js',
    globals: {},
    roots: ['<rootDir>/src'],
    testEnvironment: 'node',
    transform: {
        '^.+\\.[tj]s$': [
            'ts-jest',
            {
                tsconfig: '<rootDir>/tsconfig.spec.json',
            },
        ],
    },
    moduleFileExtensions: ['ts', 'js', 'html'],
    coverageDirectory: '../coverage/libs/lib-monad',
};
