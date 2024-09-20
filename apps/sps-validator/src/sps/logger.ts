import { log, LogLevel } from '@steem-monsters/splinterlands-validator';
import { injectable } from 'tsyringe';

export type StructuredLogMessage = Record<string, unknown> | string;

export interface Logger {
    error(message: StructuredLogMessage): void;
    warning(message: StructuredLogMessage): void;
    info(message: StructuredLogMessage): void;
    debug(message: StructuredLogMessage): void;
    trace(message: StructuredLogMessage): void;
}

function structured_log_to_string(message: StructuredLogMessage): string {
    if (typeof message === 'string') {
        return message;
    }

    return JSON.stringify(message);
}

@injectable()
export class ValidatorLogger implements Logger {
    public debug(message: StructuredLogMessage): void {
        this.log(message, LogLevel.Debug);
    }

    public error(message: StructuredLogMessage): void {
        this.log(message, LogLevel.Error);
    }

    public info(message: StructuredLogMessage): void {
        this.log(message, LogLevel.Info);
    }

    public trace(message: StructuredLogMessage): void {
        this.log(message, LogLevel.Debug);
    }

    public warning(message: StructuredLogMessage): void {
        this.log(message, LogLevel.Warning);
    }

    private log(message: StructuredLogMessage, level: LogLevel): void {
        log(structured_log_to_string(message), level);
    }
}
