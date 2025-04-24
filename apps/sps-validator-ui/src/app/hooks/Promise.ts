import { DependencyList, useEffect, useState } from 'react';

export type MaybeCancelablePromise<T> = Promise<T> & { cancel?: () => void };
export type PromiseState<T> = {
    result: T | null;
    loading: boolean;
    error: Error | null;
};

export function usePromise<T>(fn: () => MaybeCancelablePromise<T>, deps?: DependencyList): [T | null, boolean, Error | null, () => void] {
    const [result, setResult] = useState<T | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);
    const [trigger, setTrigger] = useState(0);
    const allDeps: unknown[] = [trigger];
    if (deps) {
        allDeps.push(...deps);
    }

    useEffect(() => {
        setLoading(true);
        setError(null);
        const promise = fn();
        promise
            .then((result) => {
                setResult(result);
                setLoading(false);
            })
            .catch((error) => {
                setError(error);
                setLoading(false);
            });
        return () => {
            if (promise.cancel) {
                promise.cancel();
            }
        };
    }, allDeps);

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
    }, [interval, reload]); // Added reload to dependency array
    return [result, loading, error, reload];
}
