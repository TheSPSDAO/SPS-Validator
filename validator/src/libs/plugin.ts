import { EventLog } from '../entities/event_log';
import * as utils from '../utils';
import { LogLevel } from '../utils';

export interface Plugin {
    readonly name: string;
    beforeBlockProcessed?: (blockNumber: number) => Promise<void>;
    onBlockProcessed?: (blockNumber: number, eventLogs: EventLog[], blockHash: string, headBlockNumber: number) => Promise<void>;
}

export class PluginDispatcherBuilder {
    public static create(): PluginDispatcherBuilder {
        return new PluginDispatcherBuilder([]);
    }

    private constructor(private readonly plugins: Plugin[]) {}

    public addPlugin(plugin: Plugin): PluginDispatcherBuilder {
        return new PluginDispatcherBuilder([...this.plugins, plugin]);
    }

    public build(): PluginDispatcher {
        return new PluginDispatcher(this.plugins);
    }
}

export class PluginDispatcher {
    public constructor(private readonly plugins: Plugin[]) {}

    public dispatchBefore(blockNumber: number): void {
        this.plugins.forEach((x) => {
            x.beforeBlockProcessed?.(blockNumber).catch((reason: unknown) => {
                utils.log(`Error dispatching before data to plugin ${x.name}: ${reason}`, LogLevel.Error);
            });
        });
    }

    public dispatch(blockNumber: number, eventLogs: EventLog[], blockHash: string, headBlockNumber: number): void {
        this.plugins.forEach((x) => {
            x.onBlockProcessed?.(blockNumber, eventLogs, blockHash, headBlockNumber).catch((reason: unknown) => {
                utils.log(`Error dispatching data to plugin ${x.name}: ${reason}`, LogLevel.Error);
            });
        });
    }
}
