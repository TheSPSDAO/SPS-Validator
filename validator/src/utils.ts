const logging_level = process.env.logging_level ? parseInt(process.env.logging_level) : null;

export enum LogLevel {
    None = 0,
    Error = 1,
    Warning = 2,
    Info = 3,
    Debug = 4,
}

type LogColors = keyof typeof log_colors;

// Logging levels: 1 = Error, 2 = Warning, 3 = Info, 4 = Debug
export function log(msg: string, level: LogLevel = LogLevel.None, color: LogColors | null = null) {
    if (color && log_colors[color]) msg = log_colors[color] + msg + log_colors.Reset;

    if (level <= (logging_level || 5)) console.log(`${new Date().toLocaleString()} - ${msg}`);
}

const log_colors = {
    Reset: '\x1b[0m',
    Bright: '\x1b[1m',
    Dim: '\x1b[2m',
    Underscore: '\x1b[4m',
    Blink: '\x1b[5m',
    Reverse: '\x1b[7m',
    Hidden: '\x1b[8m',

    Black: '\x1b[30m',
    Red: '\x1b[31m',
    Green: '\x1b[32m',
    Yellow: '\x1b[33m',
    Blue: '\x1b[34m',
    Magenta: '\x1b[35m',
    Cyan: '\x1b[36m',
    White: '\x1b[37m',

    BgBlack: '\x1b[40m',
    BgRed: '\x1b[41m',
    BgGreen: '\x1b[42m',
    BgYellow: '\x1b[43m',
    BgBlue: '\x1b[44m',
    BgMagenta: '\x1b[45m',
    BgCyan: '\x1b[46m',
    BgWhite: '\x1b[47m',
};

export function tryParse(json: string) {
    try {
        return JSON.parse(json);
    } catch (err) {
        log(`Error trying to parse JSON: ${json}`, LogLevel.Info, 'Red');
        return null;
    }
}

export function not_void<T>(value: T | void): value is T {
    return value !== undefined;
}

/**
 * Generator for zipping up 2 iterables.
 */
export function* zip<V, W>(vs: Iterable<V>, ws: Iterable<W>): Iterable<[V, W]> {
    const vsI = vs[Symbol.iterator]();
    const wsI = ws[Symbol.iterator]();
    while (true) {
        const { done: vdone, value: vvalue } = vsI.next();
        if (vdone) {
            return;
        }
        const { done: wdone, value: wvalue } = wsI.next();
        if (wdone) {
            return;
        }
        yield [vvalue, wvalue];
    }
}
