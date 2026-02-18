import { BlockRepository, MedianPriceCalculator, PriceEntry, PriceHistoryRepository, ValidatorRepository, ValidatorWatch } from '@steem-monsters/splinterlands-validator';
import { SpsPriceFeed } from './price-feed';

function entry(validator: string, token_price: number, block_time: Date): PriceEntry {
    return {
        validator,
        token: 'SPS',
        block_num: 1,
        block_time,
        token_price,
    };
}

test('Uses only current top validators when calculating price', async () => {
    const now = new Date('2026-02-18T12:00:00.000Z');
    const entries = [entry('validator-a', 1, now), entry('validator-b', 10, now), entry('validator-c', 1, now), entry('validator-x', 5, now)];

    const priceHistoryRepository = {
        groupedHistory: jest.fn().mockResolvedValue({ SPS: entries }),
        upsert: jest.fn(),
    } as unknown as PriceHistoryRepository;
    const blockRepository = {
        getLatestBlockNum: jest.fn().mockResolvedValue(1),
        getByBlockNum: jest.fn().mockResolvedValue({ block_time: now }),
    } as unknown as BlockRepository;
    const validatorRepository = {
        getValidators: jest.fn().mockResolvedValue({ validators: [{ account_name: 'validator-a' }, { account_name: 'validator-b' }, { account_name: 'validator-c' }] }),
    } as unknown as ValidatorRepository;
    const validatorWatch = {
        validator: { num_top_validators: 3 },
    } as unknown as ValidatorWatch;

    const feed = new SpsPriceFeed(priceHistoryRepository, new MedianPriceCalculator(), blockRepository, validatorRepository, validatorWatch);

    await expect(feed.getPriceAtPoint('SPS', now)).resolves.toBe(1);
});

test('Stops using a validator price once that validator drops out of top set', async () => {
    const now = new Date('2026-02-18T12:00:00.000Z');
    const entries = [entry('validator-a', 1, now), entry('validator-b', 10, now), entry('validator-c', 1, now), entry('validator-x', 5, now)];

    const priceHistoryRepository = {
        groupedHistory: jest.fn().mockResolvedValue({ SPS: entries }),
        upsert: jest.fn(),
    } as unknown as PriceHistoryRepository;
    const blockRepository = {
        getLatestBlockNum: jest.fn().mockResolvedValue(1),
        getByBlockNum: jest.fn().mockResolvedValue({ block_time: now }),
    } as unknown as BlockRepository;
    const validatorRepository = {
        getValidators: jest
            .fn()
            .mockResolvedValueOnce({ validators: [{ account_name: 'validator-a' }, { account_name: 'validator-b' }, { account_name: 'validator-x' }] })
            .mockResolvedValueOnce({ validators: [{ account_name: 'validator-a' }, { account_name: 'validator-b' }, { account_name: 'validator-c' }] }),
    } as unknown as ValidatorRepository;
    const validatorWatch = {
        validator: { num_top_validators: 3 },
    } as unknown as ValidatorWatch;

    const feed = new SpsPriceFeed(priceHistoryRepository, new MedianPriceCalculator(), blockRepository, validatorRepository, validatorWatch);

    await expect(feed.getPriceAtPoint('SPS', now)).resolves.toBe(5);
    await expect(feed.getPriceAtPoint('SPS', now)).resolves.toBe(1);
});
