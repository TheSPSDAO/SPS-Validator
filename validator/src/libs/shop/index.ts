import { array, boolean, date, InferType, mixed, number, object, string } from 'yup';
import { ActionIdentifier, ErrorType } from '../../entities/errors';
import {
    BalanceGetter,
    BonusEntry,
    DiscountEntry,
    DistributionEntry,
    NormalizedSaleDiscount,
    PriceConsumer,
    PriceEntry,
    Sale,
    SaleError,
    SaleTransfer,
    ShopError,
    ShopItem,
    ShopItemType,
    ShopTokenConfig,
    Supply,
    Time,
    Tranche,
} from './types';
import { PRNG } from 'seedrandom';
import { sha256 } from 'js-sha256';
import { PriceFeedError } from '../../utilities/price_feed';
import { isSystemAccount } from '../../utilities/accounts';
import { EventLog, EventTypes } from '../../entities/event_log';
import { hiveUsernameOrSystemAccount } from '../../actions/schema';

type InvalidBonus = { type: 'invalid' };
type ValidBonus = { type: 'valid'; extra_qty: number; token_qty: number; token: string };
type EmptyBonus = { type: 'empty'; extra_qty: number; token_qty: number };
type Bonus = InvalidBonus | ValidBonus | EmptyBonus;
const Bonus = {
    Invalid: () => ({ type: 'invalid' } as const),
    Valid: (extra_qty: number, token_qty: number, token: string) =>
        ({
            type: 'valid',
            extra_qty,
            token_qty,
            token,
        } as const),
    Empty: () => ({ type: 'empty', token_qty: 0, extra_qty: 0 } as const),
};

function isValidSystemAccount(value: string | undefined): boolean {
    return value === undefined || isSystemAccount(value);
}

// These are defaults that might need to be validated
const Defaults = {
    burnAccount: '$BURN',
    balanceAccount: '$SHOP',
    daoAccount: 'sps.dao',
} as const;

export const systemUsername = string().test('account_validation', 'The following input is not a system account.', isValidSystemAccount).strict();

type type_check<T, _W extends T> = never;
export const distribution_schema = object({
    account: hiveUsernameOrSystemAccount.required().default(Defaults.daoAccount),
    fraction: number().min(0).max(1.0).required(),
});

// Only to assert types. Can be replaced by const burn_schema: ObjectSchema<DistributionEntry> = ...
type _distribution = type_check<DistributionEntry, InferType<typeof distribution_schema>>;

const discount_schema = object({
    currency: string().strict().required(),
    max_amount: number().positive().required(),
    discount_rate: number().positive().required(),
}).unknown(true);

// Only to assert types. Can be replaced by const discount_schema: ObjectSchema<DiscountEntry> = ...
type _discount = type_check<DiscountEntry, InferType<typeof discount_schema>>;

const bonus_schema = object({
    currency: string().strict().required(),
    brackets: array()
        .of(
            object({
                min: number().min(0).integer().required(),
                ratio: number().min(0).required(),
            }),
        )
        .required(),
}).unknown(true);

type _bonus = type_check<BonusEntry, InferType<typeof bonus_schema>>;

const price_schema = object({
    currency: string().strict().required(),
    amount: number().positive().required(),
    accepted_currency: string()
        .strict()
        .when('currency', {
            is: 'USD',
            then: (schema) => schema.required(),
            otherwise: (schema) => schema.transform(() => undefined),
        }),
    burn: distribution_schema.optional().default(undefined),
    discountable: boolean().optional().default(false),
}).unknown(true);

// Only to assert types. Can be replaced by const price_schema: ObjectSchema<PriceEntry> = ...
type _price = type_check<PriceEntry, InferType<typeof price_schema>>;

const shop_schema = object({
    start_date: date()
        .required()
        .default(() => new Date(0)),
    // Not sure what we can do with shop things that do not require a spellbook, but this should not be our problem anyway
    requires_spellbook: boolean().required().default(true),
    price: array(price_schema).min(1).required(),
    discount: discount_schema.optional().default(undefined),
    supply: mixed<Supply>().oneOf(Object.values(Supply)).required().default(Supply.UNLIMITED),
    balance_account: systemUsername.required().default(Defaults.balanceAccount),
    accepted_currency: string()
        .strict()
        .when('currency', {
            is: 'USD',
            then: (schema) => schema.required(),
            otherwise: (schema) => schema.transform(() => undefined),
        }),
    type: mixed<ShopItemType>().oneOf(Object.values(ShopItemType)).required(),
    tranche_reserves: number().min(0).optional(),
    // TODO: Default should be 0 according to a comment in SM, but is 2.
    cooldown: number().required().default(2),
    max: number().required().default(1),
}).unknown(true);

const token_schema = shop_schema.concat(
    object({
        item_details_name: string().required(),
        type: mixed<ShopItemType.TOKEN>().oneOf([ShopItemType.TOKEN]).required(),
        token: string().strict().required(),
    }),
);

// Only to assert types. Can be replaced by const price_schema: ObjectSchema<ShopTokenConfig> = ...
type _token = type_check<ShopTokenConfig, InferType<typeof token_schema>>;

export type SaleResult = SaleTransfer;
export type TypeItemNormal = { element: 'price' | 'discount' | 'bonus' | 'purchased'; token: string; amount: number };
export type TypeItemConverted = Omit<TypeItemNormal, 'element'> & { element: `${TypeItemNormal['element']}_converted`; paid_token: string; conversion_rate: number };
export type TypeItem = TypeItemNormal | TypeItemConverted;
export type SaleReport = EventLog<{ type_items: TypeItem[] }>;

/***
 * ShopError - Either the game admin or the programmers made a mistake
 * SaleError - A sale was just not valid, or there were not enough funds. Should assume the sale did not go through
 *
 * Random notes: Discounts apply to an entry with USD currency, and nothing else.
 *
 * Known shortcoming, inherited from the existing SteemMonsters shop: Since sending out a sale order only refers to shop items via id, you can inadvertently buy something from an upcoming tranche for whatever prices they go, provided you have the funds.
 */
export class Shop<Cookie = void> {
    private static readonly discriminator_schema = object({
        type: mixed<ShopItemType>().oneOf(Object.values(ShopItemType)).required(),
    });

    // Token sales are meant to be dealt with entirely by the validator
    // Could perhaps be renamed to be 'internal sales'
    private readonly tokenSales = new Map<string | symbol, ShopTokenConfig | Tranche<ShopTokenConfig>>();

    constructor(
        // TODO: this clock now uses the _last_ time. It might rather use the current time instead?
        private readonly time: Time,
        private readonly balanceGetter: BalanceGetter<Cookie>,
        private readonly consumer: PriceConsumer<Cookie>,
    ) {}

    clear() {
        this.tokenSales.clear();
    }

    static from(v: unknown) {
        // TODO: Extend with more types
        if (Shop.discriminator_schema.isValidSync(v)) {
            switch (v.type) {
                case ShopItemType.TOKEN:
                    return token_schema.validateSync(token_schema.cast(v));
            }
        }
        throw new ShopError(`Unknown shop configuration object at runtime. (Currently only tokens are supported).`);
    }

    private static basicMatches(item1: ShopItem, item2: ShopItem) {
        return item1.balance_account === item2.balance_account && item1.requires_spellbook === item2.requires_spellbook;
    }

    private static tokenMatches(token: ShopTokenConfig, shopItem: ShopItem): shopItem is ShopTokenConfig {
        return this.basicMatches(token, shopItem) && shopItem.type === ShopItemType.TOKEN && token.token === shopItem.token;
    }

    private static everyTokenMatches(token: ShopTokenConfig, shopItems: ShopItem[]): shopItems is ShopTokenConfig[] {
        return shopItems.every((v) => this.tokenMatches(token, v));
    }

    private static everyTrancheIncreases(shopItems: ShopItem[]) {
        const isTrancheSorted = shopItems.every((v, i, a) => {
            if (!i) {
                return true;
            }
            const prev = a[i - 1].tranche_reserves;
            if (prev === undefined) {
                return false;
            }
            if (v.tranche_reserves === undefined) {
                return true;
            }
            return prev >= v.tranche_reserves;
        });
        return isTrancheSorted;
    }

    private async getCurrentTrancheWithConditionalMax<T extends ShopItem>(values: T | Tranche<T>, cookie?: Cookie): Promise<[T, number | undefined]> {
        if (Array.isArray(values)) {
            if (values.length < 2) {
                throw new ShopError(`Tranche sale is not correctly registered`);
            }

            const marker = values[0];
            const balanceTotal = await this.balanceGetter.getBalance(marker.balance_account, marker.token, cookie);
            let tranche = values.find((p) => p.tranche_reserves && balanceTotal > p.tranche_reserves);

            if (!tranche) {
                // Sold out? Use last tranche
                tranche = values[values.length - 1];
            }

            if (tranche.supply === Supply.UNLIMITED) {
                return [tranche, undefined];
            } else {
                const remaining = balanceTotal - (tranche.tranche_reserves || 0);
                return [tranche, remaining];
            }
        } else {
            if (values.supply === Supply.UNLIMITED) {
                return [values, undefined];
            }
            // TODO: Refine typings.
            const remaining = await this.balanceGetter.getBalance(values.balance_account, values.token, cookie);
            return [values, remaining];
        }
    }

    registerSale(id: string | symbol, config0: ShopItem, ...restTranchesConfig: ShopItem[]) {
        // TODO: Currently assume all shop items are sane (e.g. have no duplicated token PriceEntry).
        const duplicateSaleKey = this.tokenSales.has(id);
        if (duplicateSaleKey) {
            throw new ShopError(`A sale with key [${String(id)}] has already been registered.`);
        }

        // TODO: verify that the shop account owns enough tokens to provide everything for the sale

        if (restTranchesConfig.length) {
            // Since we use balances to keep track of tranche sales, we currently need any tranched sale be have a limited supply. This need not apply to the very last tranche.
            const allButLastFinite = config0.supply === Supply.LIMITED && restTranchesConfig.slice(0, -1).every((v) => v.supply === Supply.LIMITED);
            if (!allButLastFinite) {
                throw new ShopError('Not all earlier tranches have a limited supply.');
            }

            const all = [config0, ...restTranchesConfig];
            // If this is supposed to be a tranched sale, every sale but the last should have a tranche_reserve property, and be ordered from big to small.
            const isTrancheSorted = Shop.everyTrancheIncreases(all);
            if (!isTrancheSorted) {
                throw new ShopError('Tranches are not correctly ordered.');
            }

            // TODO: assert tranche_reserves is monotonically decreasing?

            // If this is supposed to be a tranche sale, most (relevant) properties should be identical
            if (config0.type === ShopItemType.TOKEN) {
                if (Shop.everyTokenMatches(config0, restTranchesConfig)) {
                    this.tokenSales.set(id, [config0, ...restTranchesConfig]);
                } else {
                    throw new ShopError('Not all shopitems in tranch seem to match');
                }
            }
        } else {
            if (config0.type === ShopItemType.TOKEN) {
                this.tokenSales.set(id, config0);
            }
        }
        const registeredSaleKey = this.tokenSales.has(id);
        if (!registeredSaleKey) {
            throw new ShopError(`No sale with key [${String(id)}] seems to have been registered.`);
        }
    }

    private async convertCurrency(token: string, amount: number, time: Date, cookie?: Cookie) {
        let pricepoint: number | undefined;
        try {
            pricepoint = await this.consumer.getPriceAtPoint(token, time, cookie);
        } catch (e: unknown) {
            // Swallow PriceFeedError and leave pricepoint undefined
            if (!(e instanceof PriceFeedError)) {
                throw e;
            }
        }
        if (!pricepoint || pricepoint <= 0) {
            throw new ShopError(`Shop did not find a valid price for token ${token} at time ${time}.`);
        }
        return amount / pricepoint;
    }

    private async normalizePriceEntry(entry: PriceEntry, time: Date, saleQty: number, cookie?: Cookie) {
        if (entry.currency !== 'USD') {
            return {
                ...entry,

                amount: saleQty * entry.amount,
            };
        } else if (entry.currency === 'USD' && entry.accepted_currency) {
            return {
                ...entry,
                currency: entry.accepted_currency,
                amount: saleQty * (await this.convertCurrency(entry.accepted_currency, entry.amount, time, cookie)),
            };
        } else {
            throw new ShopError(`Shop cannot process a sale that has solely USD listed as currency.`);
        }
    }

    private normalizeDiscount(sale: Sale): NormalizedSaleDiscount | undefined {
        // TODO fix this to not rely on voucher
        return sale.discount_token;
    }

    private static summarizeCosts(final: PriceEntry[], discount?: NormalizedSaleDiscount) {
        const m = new Map<string, number>();
        if (discount) {
            m.set(discount.token, discount.qty);
        }

        for (const p of final) {
            const current = m.get(p.currency) ?? 0;
            m.set(p.currency, current + p.amount);
        }

        return m;
    }

    private applyDiscount(claimedDiscount: NormalizedSaleDiscount | undefined, item: ShopItem, aid: ActionIdentifier, saleQty: number): PriceEntry[] {
        const providedDiscount = item.discount;
        if (claimedDiscount) {
            if (!providedDiscount || providedDiscount.currency !== claimedDiscount.token || providedDiscount.max_amount * saleQty < claimedDiscount.qty) {
                throw new SaleError(`Claimed discount does not apply to provided discount options.`, aid, ErrorType.SaleDiscountMismatch);
            }

            const nprices: PriceEntry[] = [];
            const discount = claimedDiscount.qty * providedDiscount.discount_rate;
            const discountPerUnit = discount / saleQty;
            for (const entry of item.price) {
                if (entry.currency === 'USD' || entry.discountable) {
                    const finalPrice = entry.amount - discountPerUnit;
                    nprices.push({ ...entry, amount: Math.max(finalPrice, 0) });
                } else {
                    nprices.push(entry);
                }
            }
            return nprices;
        } else {
            return item.price;
        }
    }

    async currentSupply(id: string | symbol, cookie?: Cookie) {
        const matchingShopItem = this.tokenSales.get(id);
        if (!matchingShopItem) {
            return;
        }

        const [item, remaining] = await this.getCurrentTrancheWithConditionalMax(matchingShopItem, cookie);
        // TODO: could perhaps be precomputed
        const hash = Shop.itemHash(item);
        return { item, remaining, hash };
    }

    hasEntry(id: string | symbol) {
        return this.tokenSales.has(id);
    }

    private static itemHash(item: ShopItem) {
        return sha256(`${item.type}.${item.token}.${JSON.stringify(item.price)}`);
    }

    private static applyBonus(sale: Sale, shopItem: ShopTokenConfig): Bonus {
        if (sale.bonus_token === undefined) {
            return Bonus.Empty();
        }

        if (shopItem.bonus === undefined) {
            // Player requested a bonus, but there is no configuration for it. Either invalid or 0 is fine I guess.
            return Bonus.Invalid();
        }

        if (sale.bonus_token.token !== shopItem.bonus.currency) {
            // Player requested a bonus with the wrong token. (Do we really need to specify token?)
            return Bonus.Invalid();
        }

        // See if the qty falls in any of the brackets.
        const bracket = shopItem.bonus.brackets.reduce(
            (prev, cur) => {
                // Did we already select a higher bracket?
                if (prev.min > cur.min) return prev;
                // Is this current bracket too large for the current sale?
                if (cur.min > sale.qty) return prev;
                // This is the right bracket.
                return cur;
            },
            // Defaults to no bonus
            { min: 0, ratio: 0 },
        );

        const max_bonus = bracket.ratio * sale.qty;

        // For now the bonus is a 1:1 ratio, but we can change this.
        return max_bonus >= sale.bonus_token.qty ? Bonus.Valid(sale.bonus_token.qty, sale.bonus_token.qty, sale.bonus_token.token) : Bonus.Invalid();
    }

    /**
     * Returns a validated record of all side-effects that need to be persisted in the database.
     */
    async precalculateSale(player: string, sale: Sale, aid: ActionIdentifier, rng: PRNG, cookie?: Cookie): Promise<{ result: SaleResult[]; report: SaleReport }> {
        const matchingShopItem = this.tokenSales.get(sale.id);
        if (!matchingShopItem) {
            throw new SaleError(`Sale [${String(sale.id)}] does not seem to exist`, aid, ErrorType.NoSuchSale);
        }

        const [item, remaining] = await this.getCurrentTrancheWithConditionalMax(matchingShopItem, cookie);

        if (sale.hash) {
            const hash = Shop.itemHash(item);
            if (sale.hash !== hash) {
                throw new SaleError(`Sale [${String(sale.id)}] hash mismatch. Offer or tranche rolled over`, aid, ErrorType.SaleOfferMismatch);
            }
        }

        const { start_date, balance_account } = item;
        const now = this.time.current();

        if (now === undefined) {
            throw new ShopError(`Shop had to process a sale before it processed a block.`);
        }

        if (now < start_date) {
            throw new SaleError(`Sale [${String(sale.id)}] has not yet begun`, aid, ErrorType.SaleNotStarted);
        }

        const bonus = Shop.applyBonus(sale, item);

        if (bonus.type === 'invalid') {
            throw new SaleError(`Sale [${String(sale.id)}] invalid bonus`, aid, ErrorType.SaleOfferMismatch);
        }

        const total_qty = bonus.extra_qty + sale.qty;

        if (remaining !== undefined && total_qty > remaining) {
            throw new SaleError(`Sale [${String(sale.id)}] for [${total_qty}] cannot proceed: Only [${remaining}] left (in current tranche).`, aid, ErrorType.SaleOutOfStock);
        }

        if (total_qty > item.max) {
            throw new SaleError(`Sale [${String(sale.id)}] for [${total_qty}] cannot proceed: Maximum of [${item.max}] per sale.`, aid, ErrorType.MaxPerSale);
        }

        const claimedDiscount = this.normalizeDiscount(sale);
        const finalPrice: PriceEntry[] = [];
        const priceReports: TypeItem[] = [];
        for (const pe of this.applyDiscount(claimedDiscount, item, aid, sale.qty)) {
            const price = await this.normalizePriceEntry(pe, now, sale.qty, cookie);
            finalPrice.push(price);
            priceReports.push(...priceReport(price));
        }

        if (bonus.type === 'valid') {
            finalPrice.push({ amount: bonus.token_qty, currency: bonus.token });
        }

        const summary = Shop.summarizeCosts(finalPrice, claimedDiscount);

        const balances = (await this.balanceGetter.getBalances(player, cookie)).reduce((m, x) => {
            const current = m.get(x.token) ?? 0;
            m.set(x.token, current + x.balance);
            return m;
        }, new Map<string, number>());

        for (const [token, required] of summary) {
            const owned = balances.get(token) ?? 0;

            if (owned < required) {
                throw new SaleError(`Insufficient balance in sale [${String(sale.id)}] for [${token}].`, aid, ErrorType.InsufficientBalance);
            }
        }

        const results: SaleResult[] = [];
        // used discount tokens are transferred to the shop
        if (claimedDiscount) {
            results.push({
                from: player,
                to: balance_account,
                token: claimedDiscount.token,
                amount: claimedDiscount.qty,
            });
        }
        // Each price entry might distribute things to other accounts; if such a distribution entry does not exist, everything goes to the shop
        for (const price of finalPrice) {
            const d = price.distribution;
            const ds = price.distributions;
            if (d && ds) {
                throw new ShopError(`Sale [${String(sale.id)}] has both distribution and distributions: [${JSON.stringify(d)}] and [${JSON.stringify(ds)}}]`);
            }
            // TODO: add invariant of total transferred tokens staying the same: distribution should be strictly equal.
            if (d) {
                // TODO: this check could be done as part of registering a sale, but since mutability is a thing \o/, we have to do it each and every time.
                if (!isFinite(d.fraction)) {
                    throw new ShopError(`Distribution fraction for sale [${String(sale.id)}] is not finite.`);
                }
                if (d.fraction >= 1.0) {
                    results.push({ from: player, to: d.account, token: price.currency, amount: price.amount });
                } else if (d.fraction <= 0) {
                    results.push({ from: player, to: balance_account, token: price.currency, amount: price.amount });
                } else {
                    // fraction is between 0 and 1
                    results.push({
                        from: player,
                        to: d.account,
                        token: price.currency,
                        amount: price.amount * d.fraction,
                    });
                    results.push({
                        from: player,
                        to: balance_account,
                        token: price.currency,
                        amount: price.amount - price.amount * d.fraction,
                    });
                }
            } else if (ds) {
                const totalFraction = ds.reduce((acc, d) => acc + d.fraction, 0);
                if (totalFraction > 1) {
                    throw new ShopError(`Distribution fractions for sale [${String(sale.id)}] sum to more than 1.`);
                }
                for (const d of ds) {
                    if (!isFinite(d.fraction)) {
                        throw new ShopError(`Distribution fraction for sale [${String(sale.id)}] is not finite.`);
                    }
                    results.push({
                        from: player,
                        to: d.account,
                        token: price.currency,
                        amount: price.amount * d.fraction,
                    });
                }
                if (totalFraction < 1) {
                    results.push({
                        from: player,
                        to: balance_account,
                        token: price.currency,
                        amount: price.amount - price.amount * totalFraction,
                    });
                }
            } else {
                results.push({ from: player, to: balance_account, token: price.currency, amount: price.amount });
            }
        }

        const purchaseReports: TypeItem[] = [];

        if (item.type === ShopItemType.TOKEN) {
            // Tokens can just be transferred
            results.push({ from: balance_account, to: player, token: item.token, amount: total_qty });
            purchaseReports.push(...purchaseReport(item.token, total_qty));
        }

        const report: SaleReport = new EventLog(
            EventTypes.INSERT,
            { table: 'sale_report' },
            {
                type_items: [...discountReport(claimedDiscount), ...bonusReport(bonus), ...priceReports, ...purchaseReports],
            },
        );

        return { result: results, report };
    }
}

function priceReport(p: PriceEntry): TypeItem[] {
    return [{ element: 'price', amount: p.amount, token: p.accepted_currency ?? p.currency }];
}

function discountReport(d: NormalizedSaleDiscount | undefined): TypeItem[] {
    return d ? [{ token: d.token, amount: d.qty, element: 'discount' }] : [];
}

function bonusReport(b: Bonus): TypeItem[] {
    switch (b.type) {
        case 'empty':
            return [];
        case 'invalid':
            return [];
        case 'valid':
            return [{ element: 'bonus', amount: b.token_qty, token: b.token }];
    }
}

function purchaseReport(token: string, amount: number): TypeItem[] {
    return [{ token, amount, element: 'purchased' }];
}
