import { Watcher } from '@steem-monsters/splinterlands-validator';
import { number, object } from 'yup';

export type PriceFeedConfig = {
    interval_blocks: number;
};

export type PriceFeedWatch = Watcher<'price_feed', PriceFeedConfig>;
export const PriceFeedWatch: unique symbol = Symbol('PriceFeedWatch');

export const price_feed_schema = object({
    interval_blocks: number().required(),
});
