/* eslint-disable */
export default {
    displayName: 'sps-validator',
    preset: '../../jest.preset.js',
    globals: {},
    setupFilesAfterEnv: ['<rootDir>/src/sps/jest.setup.ts'],
    globalSetup: '<rootDir>/src/sps/jest.global-setup.ts',
    globalTeardown: '<rootDir>/src/sps/jest.global-teardown.ts',
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
    coverageDirectory: '../../coverage/apps/sps-validator',
};
