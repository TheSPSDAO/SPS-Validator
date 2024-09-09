export function getTotalMonths(start: Date, current: Date) {
    let months = (current.getFullYear() - start.getFullYear()) * 12;
    months += current.getMonth() - start.getMonth();
    return months < 0 ? 0 : months;
}

const DAY_IN_MILLI = 86400000;

export function daysSinceEpoch(date: Date) {
    return Math.floor(date.getTime() / DAY_IN_MILLI);
}
