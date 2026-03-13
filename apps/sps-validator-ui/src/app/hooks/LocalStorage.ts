import { useEffect, useState } from 'react';

export function getLocalStorageValue<T>(key: string, defaultValue: T) {
    const stored = localStorage.getItem(key);
    if (stored === null) {
        return defaultValue;
    }

    try {
        const parsed = JSON.parse(stored);
        return (parsed ?? defaultValue) as T;
    } catch {
        // If someone manually wrote a raw string (e.g. localStorage.setItem('api.url', 'https://...'))
        // JSON.parse will throw. For string defaults, treat the stored value as the string.
        if (typeof defaultValue === 'string') {
            return stored as unknown as T;
        }
        return defaultValue;
    }
}

export const useLocalStorage = <T>(key: string, defaultValue: T) => {
    const [value, setValue] = useState<T>(() => {
        return getLocalStorageValue<T>(key, defaultValue);
    });

    useEffect(() => {
        localStorage.setItem(key, JSON.stringify(value));
    }, [key, value]);

    return [value, setValue] as const;
};
