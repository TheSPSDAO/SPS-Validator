import { Express } from 'express';

export interface ConditionalApiActivator {
    perhapsEnableApi(): Express | void;
}
export const ConditionalApiActivator: unique symbol = Symbol('ConditionalApiActivator');

export type ApiOptions = {
    api_port: number | null;
    db_block_retention: number | null;
    health_checker: boolean;
    helmetjs: boolean;
    version: string;
};

export const ApiOptions: unique symbol = Symbol('ApiOptions');

export class DisabledApiActivator implements ConditionalApiActivator {
    perhapsEnableApi(): void {
        throw new Error(`Attempting to enable API while it is supposed to be disabled`);
    }
}
