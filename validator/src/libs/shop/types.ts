import { ErrorType, ValidationError } from '../../entities/errors';

export enum Supply {
    LIMITED = 'limited',
    UNLIMITED = 'unlimited',
}

export enum ShopItemType {
    TOKEN = 'token',
    CARD = 'card',
}

// These might need to be constrained
type token = string;
type USD = 'USD';
type currency = token | USD;

export type DistributionEntry = {
    account: string;
    fraction: number;
};

// NB, any tokens listed as a PriceEntry should have a corresponding price feed datapoint
export type PriceEntry = {
    // Currency and Accepted_Currency should not be identical
    currency: currency;
    // Should be positive
    amount: number;
    // Only required when currency is USD, for now
    accepted_currency?: currency;
    distribution?: DistributionEntry;
    distributions?: DistributionEntry[];
    discountable?: boolean;
};

export type DiscountEntry = {
    currency: currency;
    max_amount: number;
    discount_rate: number;
};

export type BonusEntry = {
    currency: currency;
    brackets: Array<{ min: number; ratio: number }>;
};

export type BaseShopItem = {
    start_date: Date;
    price: PriceEntry[];
    // NB: If discount entry is set to a token, don't use that same currency in PriceEntry
    discount?: DiscountEntry;
    supply: Supply;
    type: ShopItemType;
    max: number;
    // TODO: unused and not supported yet
    cooldown: number;
    // TODO: unused and not supported yet
    requires_spellbook: boolean;
    balance_account: string;
    tranche_reserves?: number;
    bonus?: { currency: token; brackets: [{ min: number; ratio: number }] };
};
export type ShopTokenConfig = BaseShopItem & {
    type: ShopItemType.TOKEN;
    token: token;
    item_details_name: string;
};
export type ShopItem = ShopTokenConfig;
export type Tranche<T extends ShopItem> = T[];

export type NormalizedSaleDiscount = {
    token: token;
    qty: number;
};

export type NormalizedSaleBonus = {
    token: token;
    qty: number;
};

// Result types: Precalculated results of a completed sale. Should be applied ASAP to the database.
export type SaleTransfer = {
    from: string;
    to: string;
    token: string;
    amount: number;
};

export class ShopError extends Error {}
export class SaleError<Value extends ErrorType> extends ValidationError<Value> {}

// Input type: Send by client wanting to make a purchase
export type Sale = {
    id: string | symbol;
    qty: number;
    discount_token?: NormalizedSaleDiscount;
    bonus_token?: NormalizedSaleBonus;
    hash?: string; // hash of expected thing on offer;
    // Add this here?
    // timestamp: Date;
};

export interface Time {
    current(): Date | undefined;
}

// TODO: duplicated from balance.ts
type BalanceEntry = {
    player: string;
    token: string;
    balance: number;
};

export interface BalanceGetter<T = void> {
    getBalance(account: string, token: string, cookie?: T): Promise<number>;
    getBalances(account: string, cookie?: T): Promise<BalanceEntry[]>;
}

export interface PriceConsumer<T = void> {
    getPriceAtPoint(token: string, time: Date, cookie?: T): Promise<number | undefined>;
}
