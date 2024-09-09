import { ConfigType as ConvictConfigType } from './convict-config';
import { inject, injectable, injectAll } from 'tsyringe';
import fetch from 'node-fetch';
import { backOff } from 'exponential-backoff';
import {
    SynchronisationPoint,
    CollectedSynchronisationPoint,
    ConfigType,
    SynchronisationClosure,
    ConfigLoader,
    coerceToBlockNum,
    LogLevel,
    log,
} from '@steem-monsters/splinterlands-validator';

export type SpsSynchronisationConfig = [ConvictConfigType, ConfigType];
export type ConfiguredSynchronisationPoint = SynchronisationPoint<SpsSynchronisationConfig>;
export const ConfiguredSynchronisationPoint: unique symbol = Symbol('ConfiguredSynchronisationPoint');

@injectable()
export class SpsSync extends CollectedSynchronisationPoint<SpsSynchronisationConfig> {
    constructor(@injectAll(ConfiguredSynchronisationPoint) points: SynchronisationPoint<SpsSynchronisationConfig>[]) {
        super(...points);
    }
}

@injectable()
export class SpsSynchronisationClosure extends SynchronisationClosure<SpsSynchronisationConfig> {
    constructor(
        @inject(SpsSync) wrapper: SpsSync,
        @inject(ConfigLoader) private readonly loader: ConfigLoader,
        @inject(ConvictConfigType) private readonly cfg: ConvictConfigType,
    ) {
        super(wrapper);
    }

    protected getConfig(): SpsSynchronisationConfig {
        return [this.cfg, this.loader.value];
    }
}

@injectable()
export class SteemMonstersLastBlock {
    private readonly api_url: string | null;

    constructor(@inject(ConvictConfigType) cfg: ConvictConfigType) {
        this.api_url = cfg.sm_api_url;
    }

    private static async request(api_url: string): Promise<number> {
        const url = `${api_url}/status`;
        const req = await fetch(url);
        if (req.ok) {
            const data = await req.json();
            const num = coerceToBlockNum(data?.last_block);
            if (num === null) {
                throw new Error(`last_block was not a valid block number.`);
            } else {
                return num;
            }
        } else {
            throw new Error(`Could not reach api ${url}`);
        }
    }

    async waitUntilProcessedBlock(block_num: number): Promise<void> {
        const api_url = this.api_url;
        if (api_url === null) {
            throw new Error(`Configured SM_API_URL (${this.api_url}) seems to be null.`);
        } else {
            await backOff(
                async () => {
                    const waiting = (await SteemMonstersLastBlock.request(api_url)) < block_num - 1;
                    if (waiting) {
                        throw new Error('Still waiting');
                    }
                },
                {
                    numOfAttempts: Infinity,
                    startingDelay: 3000, // 3 seconds, the amount of time for a new block to be produced
                    maxDelay: 30000, // 30 seconds, the maximum delay between retries
                    jitter: 'full', // Add some random jitter, to lighten the load on the server
                    retry: (_, attemptNumber) => {
                        log(`Attempt number ${attemptNumber} in waiting for SteemMonsters to catch up.`, LogLevel.Info);
                        return true;
                    },
                },
            );
        }
    }
}

@injectable()
export class StartupSync implements ConfiguredSynchronisationPoint {
    constructor(@inject(SteemMonstersLastBlock) private readonly req: SteemMonstersLastBlock) {}

    async waitToProcessBlock(block_num: number, cfg: ConvictConfigType, _: ConfigType): Promise<void> {
        if (block_num === coerceToBlockNum(cfg.start_block)) {
            await this.req.waitUntilProcessedBlock(block_num);
        }
    }
}
