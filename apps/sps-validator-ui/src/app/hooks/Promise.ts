import { DependencyList, useEffect, useRef, useState } from 'react';

export type MaybeCancelablePromise<T> = Promise<T> & { cancel?: () => void };
export type PromiseState<T> = {
    result: T | null;
    loading: boolean;
    error: Error | null;
};

function isCancellationError(error: unknown): boolean {
    if (!error) {
        return false;
    }

    if (typeof error === 'object') {
        const maybeError = error as { name?: unknown; message?: unknown; isCancelled?: unknown };
        if (maybeError.isCancelled === true) {
            return true;
        }
        if (maybeError.name === 'CancelError' || maybeError.name === 'AbortError') {
            return true;
        }
        if (typeof maybeError.message === 'string' && maybeError.message.toLowerCase().includes('aborted')) {
            return true;
        }
    }

    return false;
}

export function usePromise<T>(fn: () => MaybeCancelablePromise<T>, deps?: DependencyList): [T | null, boolean, Error | null, () => void] {
    const [result, setResult] = useState<T | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);
    const [trigger, setTrigger] = useState(0);

    const runIdRef = useRef(0);

    const fnRef = useRef(fn);
    useEffect(() => {
        fnRef.current = fn;
    }, [fn]);

    useEffect(() => {
        runIdRef.current += 1;
        const runId = runIdRef.current;

        setLoading(true);
        setError(null);
        const promise = fnRef.current();
        promise
            .then((result) => {
                if (runIdRef.current !== runId) {
                    return;
                }
                setResult(result);
                setLoading(false);
            })
            .catch((error) => {
                if (runIdRef.current !== runId) {
                    return;
                }

                if (isCancellationError(error)) {
                    return;
                }

                setError(error);
                setLoading(false);
            });
        return () => {
            if (promise.cancel) {
                promise.cancel();
            }
        };
        // deps are intentionally provided by the caller to control refresh behavior.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [trigger, ...(deps ?? [])]);

    return [result, loading, error, () => setTrigger((prev) => prev + 1)];
}

export function usePromiseRefresh<T>(fn: () => MaybeCancelablePromise<T>, interval: number, deps?: DependencyList): [T | null, boolean, Error | null, () => void] {
    const [result, loading, error, reload] = usePromise(fn, deps);
    useEffect(() => {
        let id: NodeJS.Timeout | undefined;
        if (interval > 0) {
            id = setInterval(() => {
                reload();
            }, interval);
        }
        return () => {
            if (id) {
                clearInterval(id);
            }
        };
    }, [interval, reload]);
    return [result, loading, error, reload];
}
