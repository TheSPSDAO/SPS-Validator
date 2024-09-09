import { ConfigData, ConfigRepository } from './config';

describe('Unparse tests', () => {
    test.each([
        [7, '7'],
        [new Date('2022-05-10T12:33:56.483Z'), '2022-05-10T12:33:56.483Z'],
        [{ mykey: 'myvalue' }, '{"mykey":"myvalue"}'],
        [[1, 2, 3], '[1,2,3]'],
        ['random-string', 'random-string'],
        [true, 'true'],
        [false, 'false'],
    ])('unparse_value(%s)', (value: ConfigData, expected: string) => {
        expect(ConfigRepository.unparse_value(value)).toBe(expected);
    });
});

describe('parse tests', () => {
    test.each([
        [7, '7', 'number'],
        [new Date('2022-05-10T12:33:56.483Z'), '2022-05-10T12:33:56.483Z', 'date'],
        [{ mykey: 'myvalue' }, '{"mykey":"myvalue"}', 'object'],
        [[1, 2, 3], '[1,2,3]', 'array'],
        ['random-string', 'random-string', 'string'],
        [true, 'true', 'boolean'],
        [false, 'false', 'boolean'],
    ])('%s from parse_value("%s", "%s")', (expected: ConfigData, value: string, type: string) => {
        expect(ConfigRepository.parse_value(value, type)).toStrictEqual(expected);
    });
});
