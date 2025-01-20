import { OperationData, PriceFeedProducer, Trx, Action, EventLog, TopPriceFeedWrapper } from '@steem-monsters/splinterlands-validator';
import { price_feed } from '../schema';
import { MakeActionFactory, MakeRouter } from '../utils';

export class TopPriceFeedAction extends Action<typeof price_feed.actionSchema> {
    constructor(op: OperationData, data: unknown, index: number, private readonly producer: PriceFeedProducer) {
        super(price_feed, op, data, index);
    }

    async process(trx?: Trx): Promise<EventLog[]> {
        const results: EventLog[] = [];
        for (const update of this.params.updates) {
            results.push(
                ...(await this.producer.addPriceEntry(
                    {
                        validator: this.op.account,
                        token: update.token,
                        token_price: update.price,
                        block_num: this.op.block_num,
                        block_time: this.op.block_time,
                    },
                    trx,
                )),
            );
        }
        return results;
    }

    async validate(_trx?: Trx): Promise<boolean> {
        return true;
    }
}

const Builder = MakeActionFactory(TopPriceFeedAction, TopPriceFeedWrapper);
export const Router = MakeRouter(price_feed.action_name, Builder);
