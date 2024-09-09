export function coerceToBlockNum(v: number | string | null | undefined): number | null {
    if (v === null || v === undefined) {
        return null;
    }

    let n: number;
    if (typeof v === 'string') {
        n = parseInt(v, 10);
    } else {
        n = Math.floor(v);
    }

    if (!isFinite(n) || n <= 0) {
        return null;
    }

    // `n` is a positive integer
    return n;
}
