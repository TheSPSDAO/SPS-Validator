import {
    ActionFactory,
    ActionRouter,
    autoroute,
    OperationData,
    PriceFeedProducer,
    Schema,
    Compute,
    RawPriceFeed,
    TopPriceFeedWrapper,
    route,
    AdminMembership,
    Trx,
    Action,
    AdminAction,
    EventLog,
} from '@steem-monsters/splinterlands-validator';
import { inject, injectable } from 'tsyringe';
import { InferType, number, object } from 'yup';
import { TOKENS } from '../../features/tokens';
import { price_feed } from '../schema';

export const legacy_price_feed = new Schema.Schema(
    price_feed.action_name,
    object({
        sps_price: number().positive().required(),
    }),
);

function normalizeLegacyPriceFeed(priceFeed: InferType<typeof legacy_price_feed.actionSchema>): InferType<typeof price_feed.actionSchema> {
    return {
        updates: [{ token: TOKENS.SPS, price: priceFeed.sps_price }],
        metadata: {},
    };
}

// TODO: Still pretty coupled with SPS validator requirements.
export class AdminPriceFeedAction extends AdminAction<typeof price_feed.actionSchema> {
    constructor(adminMembership: AdminMembership, private readonly producer: PriceFeedProducer, op: OperationData, data: unknown, index?: number) {
        super(adminMembership, price_feed, op, data, index);
    }

    async process(trx?: Trx): Promise<EventLog[]> {
        const results: EventLog[] = [];
        for (const update of this.params.updates) {
            results.push(
                ...(await this.producer.addPriceEntry(
                    {
                        validator: this.priceUpdateAccount(),
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

    protected priceUpdateAccount(): string {
        return this.op.account;
    }
}

export class TopPriceFeedAction extends Action<typeof price_feed.actionSchema> {
    constructor(op: OperationData, data: unknown, index: number, private readonly producer: PriceFeedProducer) {
        super(price_feed, op, data, index);
    }

    async process(trx?: Trx): Promise<EventLog[]> {
        const results: EventLog[] = [];
        for (const update of this.params.updates) {
            // we only need sps price right now, and only sps price is being sent
            if (update.token !== TOKENS.SPS) {
                continue;
            }

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

class LegacyAdminPriceFeedAction extends Action<typeof legacy_price_feed.actionSchema> {
    private readonly proxy: AdminPriceFeedAction;
    constructor(adminMembership: AdminMembership, producer: PriceFeedProducer, op: OperationData, data: unknown, index?: number) {
        super(legacy_price_feed, op, data, index);
        this.proxy = new AdminPriceFeedAction(adminMembership, producer, op, { action: this.id, params: normalizeLegacyPriceFeed(this.params) }, index);
    }

    validate(trx?: Trx) {
        return this.proxy.validate(trx);
    }

    protected process(trx?: Trx) {
        return this.proxy.process(trx);
    }
}

@injectable()
class AdminBuilder implements ActionFactory<LegacyAdminPriceFeedAction> {
    constructor(@inject(AdminMembership) private readonly adminMembership: AdminMembership, @inject(RawPriceFeed) private readonly producer: PriceFeedProducer) {}
    build(op: OperationData, data: unknown, index?: number) {
        return new LegacyAdminPriceFeedAction(this.adminMembership, this.producer, op, data, index);
    }
}

@injectable()
class TopBuilder implements ActionFactory<TopPriceFeedAction> {
    constructor(@inject(TopPriceFeedWrapper) private readonly producer: TopPriceFeedWrapper) {}
    build(op: OperationData, data: unknown, index: number) {
        return new TopPriceFeedAction(op, data, index, this.producer);
    }
}

@injectable()
@autoroute()
export class Router extends ActionRouter<LegacyAdminPriceFeedAction | TopPriceFeedAction> {
    static start_block(c: Compute) {
        if (c === undefined) {
            return Number.MAX_SAFE_INTEGER;
        } else if (c.paused_until_block > 0) {
            return c.paused_until_block;
        } else {
            return c.reward_start_block;
        }
    }

    @route(price_feed.action_name, { to_block: Router.start_block })
    readonly adminBuilder: AdminBuilder;

    @route(price_feed.action_name, { from_block: Router.start_block })
    readonly topBuilder: TopBuilder;

    constructor(@inject(AdminBuilder) adminBuilder: AdminBuilder, @inject(TopBuilder) topBuilder: TopBuilder) {
        super();
        this.adminBuilder = adminBuilder;
        this.topBuilder = topBuilder;
    }
}
