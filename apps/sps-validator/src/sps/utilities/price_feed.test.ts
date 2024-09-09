import { container } from '../composition-root';
import { PriceEntry, PriceHistoryRepository, RawPriceFeed } from '@steem-monsters/splinterlands-validator';
let feed: RawPriceFeed;

beforeAll(() => {
    const child = container.createChildContainer();
    child.register(PriceHistoryRepository, { useValue: {} as PriceHistoryRepository });
    feed = child.resolve(RawPriceFeed);
});

beforeEach(() => {
    feed.clear();
});

test('Updating price entry from two validators', () => {
    const priceEntryA = { validator: 'steemmonsters', block_num: 0, token_price: 10, token: 'SPS', block_time: new Date() } as PriceEntry;
    feed.update(priceEntryA);
    expect(feed.value.get('SPS')).toEqual([priceEntryA]);
    const priceEntryB = { validator: 'tehbone', block_num: 1, token_price: 20, token: 'SPS', block_time: new Date() } as PriceEntry;
    feed.update(priceEntryB);
    expect(feed.value.get('SPS')?.length).toBe(2);
});

test('Updating price entry from one validator', () => {
    const priceEntryA = { validator: 'steemmonsters', block_num: 0, token_price: 10, token: 'SPS', block_time: new Date() } as PriceEntry;
    feed.update(priceEntryA);
    expect(feed.value.get('SPS')).toEqual([priceEntryA]);
    const priceEntryB = { validator: 'steemmonsters', block_num: 1, token_price: 20, token: 'SPS', block_time: new Date() } as PriceEntry;
    feed.update(priceEntryB);
    expect(feed.value.get('SPS')?.length).toBe(1);
    expect(feed.value.get('SPS')).toEqual([priceEntryB]);
});

test('Reload all price entries', () => {
    const priceEntryA = { validator: 'steemmonsters', block_num: 0, token_price: 10, token: 'SPS', block_time: new Date() } as PriceEntry;
    const priceEntryB = { validator: 'tehbone', block_num: 1, token_price: 20, token: 'SPS', block_time: new Date() } as PriceEntry;
    const priceMap = new Map();
    priceMap.set('SPS', [priceEntryA, priceEntryB]);
    feed.reload(priceMap);
    expect(feed.value.values).toEqual(priceMap.values);
    feed.reload(new Map());
    expect(feed.value).toEqual(new Map());
});

test('Getting multiple prices at once', async () => {
    const now = new Date();
    const priceEntryA = { validator: 'steemmonsters', block_num: 0, token_price: 10, token: 'SPS', block_time: now } as PriceEntry;
    const priceEntryB = { validator: 'tehbone', block_num: 1, token_price: 20, token: 'DEC', block_time: now } as PriceEntry;
    feed.update(priceEntryA);
    feed.update(priceEntryB);
    const prices = await feed.getPricesAtPoint(['XYZ', 'SPS'], now);
    expect(prices).toContainEqual({ token: 'XYZ', price: undefined });
    expect(prices).toContainEqual({ token: 'SPS', price: 10 });
    expect(prices).not.toContainEqual({ token: 'DEC', price: 20 });
});
