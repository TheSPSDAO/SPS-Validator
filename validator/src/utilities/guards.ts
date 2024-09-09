export function isStringArray(value: unknown): value is Array<string> {
    if (!Array.isArray(value)) {
        return false;
    }
    return value.every((v) => typeof v === 'string');
}
