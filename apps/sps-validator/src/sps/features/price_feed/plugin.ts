import { EventLog, HiveClient, LogLevel, Plugin, PriceHistoryRepository, Prime, Trx, ValidatorRepository, ValidatorWatch, log } from '@steem-monsters/splinterlands-validator';
import { inject, injectAll, singleton } from 'tsyringe';
import config from '../../convict-config';
import { ExternalPriceFeed } from './external-feeds';
import { PriceFeedWatch } from './config';
import { backOff } from 'exponential-backoff';
import { TOKENS } from '../tokens';

const HIVE_TOKEN = 'HIVE';

@singleton()
export class PriceFeedPlugin implements Plugin, Prime {
    readonly name = 'price_feed';

    private readonly CHANGE_KEY = Symbol('PRICE_FEED_PLUGIN_CHANGE_KEY');

    private primed = false;
    private lastSentBlock: number | undefined;
    private nextBlock: number | undefined;

    constructor(
        @inject(HiveClient) private readonly hive: HiveClient,
        @inject(PriceFeedWatch) private readonly priceFeedWatch: PriceFeedWatch,
        @inject(PriceHistoryRepository) private readonly priceHistoryRepository: PriceHistoryRepository,
        @inject(ValidatorWatch) private readonly validatorWatch: ValidatorWatch,
        @inject(ValidatorRepository) private readonly validatorRepository: ValidatorRepository,
        @injectAll(ExternalPriceFeed) private readonly feeds: ExternalPriceFeed[],
    ) {
        this.priceFeedWatch.addPriceFeedWatcher(this.CHANGE_KEY, (config) => {
            this.nextBlock = undefined;
        });
    }

    async prime(trx?: Trx | undefined): Promise<void> {
        // the api will prime on every request but we are a singleton so we only need to prime once
        if (this.primed) {
            return;
        }
        this.primed = true;

        if (!this.priceFeedWatch.price_feed) {
            log('Price Feed config is invalid. Not setting next price feed block.', LogLevel.Warning);
            return;
        }

        const lastPriceEntry = await this.priceHistoryRepository.getLastPriceEntry(config.validator_account, TOKENS.SPS, trx);
        this.lastSentBlock = lastPriceEntry ? lastPriceEntry.block_num : undefined;
        this.nextBlock = this.lastSentBlock ? this.getNextBlock(this.lastSentBlock) : undefined;
        log(`Next price feed block: ${this.nextBlock ?? 'asap'}. Available feeds: ${this.feeds.map((f) => f.name).join(', ')}`, LogLevel.Info);
    }

    static isAvailable() {
        return config.validator_account && config.validator_key;
    }

    async onBlockProcessed(blockNumber: number, _: EventLog<any>[], blockHash: string, headBlockNumber: number): Promise<void> {
        if (!this.priceFeedWatch.price_feed) {
            log('Price feed config is invalid. Not sending price.', LogLevel.Warning);
            return;
        } else if (!this.validatorWatch.validator) {
            log('Validator config is invalid. Not sending price.', LogLevel.Warning);
            return;
        } else if (this.nextBlock && headBlockNumber < this.nextBlock) {
            return;
        }

        // prevent sending a ton of prices if we're far behind
        const blockLag = headBlockNumber - blockNumber;
        if (blockLag > this.priceFeedWatch.price_feed.interval_blocks) {
            log(`Block lag is too high (${blockLag}). Not sending price.`, LogLevel.Debug);
            // reset next block if we're too far behind, and send the price as soon as we catch up
            this.nextBlock = undefined;
            return;
        }

        const isTopValidator = await this.validatorRepository.isTopValidator(config.validator_account, this.validatorWatch.validator.num_top_validators);
        if (!isTopValidator) {
            log('Not a top validator. Not sending price.', LogLevel.Debug);
            return;
        }

        if (this.validatorWatch.validator.reward_start_block > headBlockNumber) {
            log('Validator rewards have not started yet. Not sending price.', LogLevel.Debug);
            return;
        } else if (this.validatorWatch.validator.paused_until_block > 0 && this.validatorWatch.validator.paused_until_block > headBlockNumber) {
            log('Validator rewards are paused. Not sending price.', LogLevel.Debug);
            return;
        }

        // plugins are run asynchronously, so we need to set nextBlock before calling into async code
        this.nextBlock = this.getNextBlock(headBlockNumber);

        try {
            const result = await this.getTokenPriceInUSD(TOKENS.SPS);
            const confirmation = await this.hive.submitPriceFeed([{ token: TOKENS.SPS, price: result.price }], result.metadata);
            this.lastSentBlock = headBlockNumber;
            log(`Sent price feed at block ${headBlockNumber}. trx_id: ${confirmation.id}`, LogLevel.Info);
        } catch (err) {
            log(`Failed to send price feed at block ${headBlockNumber}: ${err}`, LogLevel.Error);
            // reset next check in block if it failed
            this.nextBlock = undefined;
        }
    }

    private async getTokenPriceInUSD(token: string) {
        const randomizedFeeds = this.feeds.sort(() => Math.random() - 0.5);
        let externalHivePrice: number | null = null;
        let feedUsed: string | null = null;
        for (const feed of randomizedFeeds) {
            try {
                const maybeHivePrice = await backOff(() => feed.getTokenPriceInUSD(HIVE_TOKEN), {
                    numOfAttempts: 3,
                    startingDelay: 1000,
                    maxDelay: 3000,
                    timeMultiple: 2,
                });
                if (maybeHivePrice === undefined) {
                    continue;
                }
                externalHivePrice = maybeHivePrice;
                feedUsed = feed.name;
            } catch (err) {
                console.error(err);
                log(`Failed to get HIVE price from ${feed.name}: ${err}`, LogLevel.Warning);
            }
        }

        if (externalHivePrice === null) {
            throw new Error('Failed to get HIVE price from any external feed');
        }

        const hePrice = await backOff(() => this.hive.getHiveEnginePrice(`SWAP.HIVE:${token}`), {
            numOfAttempts: 3,
            startingDelay: 1000,
            maxDelay: 3000,
            timeMultiple: 2,
        });
        const hePriceParsed = parseFloat(hePrice);
        if (isNaN(hePriceParsed)) {
            throw new Error(`Failed to get price for ${token} from Hive Engine`);
        } else if (hePriceParsed === 0) {
            return {
                price: 0,
                metadata: {
                    hive_usd: externalHivePrice,
                    he_price: hePriceParsed,
                    external_feed: feedUsed,
                },
            };
        }

        return {
            price: parseFloat((externalHivePrice / hePriceParsed).toFixed(7)),
            metadata: {
                hive_usd: externalHivePrice,
                he_price: hePriceParsed,
                external_feed: feedUsed,
            },
        };
    }

    private getNextBlock(lastBlockNum: number): number {
        return lastBlockNum + this.priceFeedWatch.price_feed!.interval_blocks + Math.floor(Math.random() * this.priceFeedWatch.price_feed!.interval_blocks);
    }
}
