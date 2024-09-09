export type Ok<T> = {
    status: 'ok';
    value: T;
};

export type Err<E> = {
    status: 'err';
    error: E;
};

export type Result<T, E> = Ok<T> | Err<E>;

export const Result = {
    Ok: <T>(value: T): Ok<T> => ({ status: 'ok', value } as const),
    OkVoid: (): Ok<void> => ({ status: 'ok', value: undefined } as const),
    Err: <E>(error: E): Err<E> =>
        ({
            status: 'err',
            error,
        } as const),
    isErr: <T, E>(result: Result<T, E>): result is Err<E> => result.status === 'err',
    isOk: <T, E>(result: Result<T, E>): result is Ok<T> => result.status === 'ok',
} as const;
