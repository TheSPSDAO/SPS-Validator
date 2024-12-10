import { useEffect, useState } from 'react';

export function getLocalStorageValue<T>(key: string, defaultValue: T) {
    const stored = localStorage.getItem(key);
    const parsed = stored !== null ? JSON.parse(stored) : null;
    return parsed ?? defaultValue;
}

export const useLocalStorage = <T>(key: string, defaultValue: T) => {
    const [value, setValue] = useState(() => {
        return getLocalStorageValue(key, defaultValue);
    });

    useEffect(() => {
        localStorage.setItem(key, JSON.stringify(value));
    }, [key, value]);

    return [value, setValue];
};
