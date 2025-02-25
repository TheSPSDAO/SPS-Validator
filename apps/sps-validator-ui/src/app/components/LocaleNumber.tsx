export function localeNumber(value: number | string, precision = 3) {
    const coerced = typeof value === 'string' ? Number(value) : value;
    const number = Number((Number.isNaN(coerced) ? 0 : coerced).toFixed(precision)).toLocaleString();
    return number;
}
