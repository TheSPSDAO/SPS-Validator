import { BlockRepository } from '../entities/block';
import { PriceEntry, PriceHistoryRepository } from '../entities/tokens/price_history';
import { MedianPriceCalculator, RawPriceFeed } from './price_feed';

function priceEntry(validator: string, tokenPrice: number, blockTime: Date): PriceEntry {
    return {
        validator,
        token: 'SPS',
        block_num: 0,
        block_time: blockTime,
        token_price: tokenPrice,
    };
}

function createFeed(entries: PriceEntry[], latestBlockTime: Date): RawPriceFeed {
    const historyRepository = {
        groupedHistory: jest.fn().mockResolvedValue({ SPS: entries }),
        upsert: jest.fn(),
    } as unknown as PriceHistoryRepository;
    const blockRepository = {
        getLatestBlockNum: jest.fn().mockResolvedValue(1),
        getByBlockNum: jest.fn().mockResolvedValue({ block_time: latestBlockTime }),
    } as unknown as BlockRepository;

    return new RawPriceFeed(historyRepository, new MedianPriceCalculator(), blockRepository);
}

test('Prefers fresh entries when at least seven feeds are recent', async () => {
    const now = new Date('2026-02-18T12:00:00.000Z');
    const fresh = Array.from({ length: 7 }, (_, i) => priceEntry(`fresh-${i}`, 1, new Date(now.getTime() - 60 * 60 * 1000)));
    const stale = Array.from({ length: 8 }, (_, i) => priceEntry(`stale-${i}`, 2, new Date(now.getTime() - 24 * 60 * 60 * 1000)));
    const feed = createFeed([...fresh, ...stale], now);

    await expect(feed.getPriceAtPoint('SPS', now)).resolves.toBe(1);
});

test('Falls back to older entries when fewer than seven fresh feeds are available', async () => {
    const now = new Date('2026-02-18T12:00:00.000Z');
    const fresh = Array.from({ length: 6 }, (_, i) => priceEntry(`fresh-${i}`, 1, new Date(now.getTime() - 30 * 60 * 1000)));
    const stale = Array.from({ length: 8 }, (_, i) => priceEntry(`stale-${i}`, 2, new Date(now.getTime() - 24 * 60 * 60 * 1000)));
    const feed = createFeed([...fresh, ...stale], now);

    await expect(feed.getPriceAtPoint('SPS', now)).resolves.toBe(2);
});

test('Filters obvious outliers before median calculation', async () => {
    const now = new Date('2026-02-18T12:00:00.000Z');
    const entries = [
        priceEntry('v1', 1, new Date(now.getTime() - 30 * 60 * 1000)),
        priceEntry('v2', 1, new Date(now.getTime() - 30 * 60 * 1000)),
        priceEntry('v3', 2, new Date(now.getTime() - 30 * 60 * 1000)),
        priceEntry('v4', 100, new Date(now.getTime() - 30 * 60 * 1000)),
        priceEntry('v5', 100, new Date(now.getTime() - 30 * 60 * 1000)),
    ];
    const feed = createFeed(entries, now);

    await expect(feed.getPriceAtPoint('SPS', now)).resolves.toBe(1);
});
