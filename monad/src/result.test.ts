import { Result } from './result';

describe('Result', () => {
    test('isOk(ok)', () => {
        const result = Result.Ok(undefined);

        expect(Result.isOk(result)).toBeTruthy();
    });

    test('isOk(error)', () => {
        const result = Result.Err(undefined);

        expect(Result.isOk(result)).toBeFalsy();
    });

    test('isErr(error)', () => {
        const result = Result.Err(undefined);

        expect(Result.isErr(result)).toBeTruthy();
    });

    test('isErr(ok)', () => {
        const result = Result.Ok(undefined);

        expect(Result.isErr(result)).toBeFalsy();
    });

    test('Ok construction', () => {
        const result = Result.Ok('hello');

        expect(result.value).toBe('hello');
    });

    test('Err construction', () => {
        const result = Result.Err('hello');

        expect(result.error).toBe('hello');
    });
});
