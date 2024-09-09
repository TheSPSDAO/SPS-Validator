import { coerceToBlockNum, log, LogLevel, Plugin } from '@steem-monsters/splinterlands-validator';

export class KillPlugin implements Plugin {
    readonly name: string = 'KillAtBlockPlugin';
    private readonly killBlock: number;

    public static isAvailable(): boolean {
        return coerceToBlockNum(process.env.KILL_BLOCK) !== null;
    }

    public constructor(private readonly logLevel: LogLevel = LogLevel.Warning) {
        this.killBlock = coerceToBlockNum(process.env.KILL_BLOCK) ?? Number.POSITIVE_INFINITY;
        log(`Validator configured to be killed at block ${this.killBlock}`, this.logLevel);
    }

    public async beforeBlockProcessed(blockNumber: number): Promise<void> {
        if (blockNumber >= this.killBlock) {
            log(`Killing validator because we've reached the kill block.`, this.logLevel);
            process.exit(1);
        }
    }
}
