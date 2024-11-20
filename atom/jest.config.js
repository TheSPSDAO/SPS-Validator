module.exports = {
    displayName: 'lib-atom',
    preset: '../jest.preset.js',
    setupFiles: ['@abraham/reflection'],
    globals: {},
    testEnvironment: 'node',
    transform: {
        '^.+\\.[tj]sx?$': [
            'ts-jest',
            {
                tsconfig: '<rootDir>/tsconfig.spec.json',
            },
        ],
    },
    moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
    coverageDirectory: '../../coverage/libs/atom',
};
