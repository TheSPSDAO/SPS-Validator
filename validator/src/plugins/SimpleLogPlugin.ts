import { Plugin } from '../libs/plugin';
import { EventLog } from '../entities/event_log';
import * as utils from '../utils';
import { LogLevel } from '../utils';

/**
 * Example plugin that logs whatever happens with the specified (or default) LogLevel.
 */
export class SimpleLogPlugin implements Plugin {
    readonly name: string = 'SimpleLogPlugin';

    public constructor(private readonly logLevel: LogLevel = LogLevel.Info) {}

    async onBlockProcessed(blockNumber: number, eventLogs: EventLog[]): Promise<void> {
        eventLogs.forEach((log) => {
            utils.log(`[${this.name}] Performed a ${log.event_type.toUpperCase()} in ${log.object_type.toUpperCase()} in block number ${blockNumber}`, this.logLevel);
        });
    }
}
