import { SpsConfigLoader } from '../config';
import { DependencyContainer, inject, injectable } from 'tsyringe';
import { Fixture as BaseFixture } from '../../__tests__/fixture';
import { container } from '../../__tests__/test-composition-root';
import { BlockEntity, ConfigEntity, ConfigRepository, LastBlockCache, PriceHistoryEntity, Primer, RawPriceFeed, Snapshot } from '@steem-monsters/splinterlands-validator';

@injectable()
class Fixture extends BaseFixture {
    constructor(@inject(Primer) readonly primer: Primer) {
        super();
    }
}

const fixture = container.resolve(Fixture);

@injectable()
class SubFixture {
    c!: DependencyContainer;
    constructor(
        @inject(Snapshot) readonly snapshot: Snapshot<DependencyContainer>,
        @inject(SpsConfigLoader) readonly configLoader: SpsConfigLoader,
        @inject(RawPriceFeed) readonly feed: RawPriceFeed,
        @inject(LastBlockCache) readonly lastBlockCache: LastBlockCache,
    ) {}
}

let subfixture: SubFixture;

beforeAll(async () => {
    await fixture.init();
});

beforeEach(async () => {
    await fixture.restore();
    await fixture.testHelper.insertDefaultConfiguration();
    await fixture.handle.query(ConfigEntity).where('group_name', 'validator').andWhere('name', 'max_votes').updateItem({ value: '7' });
    await fixture.handle.query(PriceHistoryEntity).insertItem({
        validator: 'somevalidator',
        token: 'SPS',
        block_num: 1,
        block_time: new Date(),
        token_price: String(12.7),
    });
    await fixture.handle.query(BlockEntity).insertItem({
        block_time: new Date(),
        block_num: 1,
        block_id: 'random-block-id',
        prev_block_id: 'previous-random-block-id',
        l2_block_id: 'l2-hash-placeholder',
    });
    const c = container.createChildContainer();
    await fixture.primer.prime();
    subfixture = c.resolve(SubFixture);
    subfixture.c = c;
});

afterAll(async () => {
    await fixture.dispose();
});

describe('ConfigLoader', () => {
    test.dbOnly('Without any commit ', async () => {
        const { c, configLoader, snapshot } = subfixture;
        await configLoader.reloadingUpdateConfig('validator', 'max_votes', ConfigRepository.unparse_value(8));
        expect(configLoader.validator?.max_votes).toBe(8);
        snapshot.injectAll(c);
        const { configLoader: snapshottedConfigLoader } = c.resolve(SubFixture);
        expect(snapshottedConfigLoader.validator?.max_votes).toBe(7);
    });

    test.dbOnly('With commit ', async () => {
        const { c, configLoader, snapshot } = subfixture;
        await configLoader.reloadingUpdateConfig('validator', 'max_votes', ConfigRepository.unparse_value(8));
        expect(configLoader.validator?.max_votes).toBe(8);
        snapshot.commit();
        snapshot.injectAll(c);
        const { configLoader: snapshotConfigLoader } = c.resolve(SubFixture);
        expect(snapshotConfigLoader.validator?.max_votes).toBe(8);
    });

    test.dbOnly('With rollback ', async () => {
        const { c, configLoader, snapshot } = subfixture;
        await configLoader.reloadingUpdateConfig('validator', 'max_votes', ConfigRepository.unparse_value(9));
        expect(configLoader.validator?.max_votes).toBe(9);
        snapshot.rollback();
        expect(configLoader.validator?.max_votes).toBe(7);
        snapshot.injectAll(c);
        const { configLoader: snapshotConfigLoader } = c.resolve(SubFixture);
        expect(snapshotConfigLoader.validator?.max_votes).toBe(7);
    });
});

describe('PriceFeed', () => {
    test.dbOnly('Without any commit ', async () => {
        const { c, feed, snapshot } = subfixture;
        await feed.addPriceEntry({
            validator: 'somevalidator',
            token: 'SPS',
            block_num: 2,
            block_time: new Date(),
            token_price: 3,
        });
        await expect(feed.getPriceAtPoint('SPS', new Date())).resolves.toBe(3);
        snapshot.injectAll(c);
        const { feed: snapshotFeed } = c.resolve(SubFixture);
        await expect(snapshotFeed.getPriceAtPoint('SPS', new Date())).resolves.toBe(12.7);
    });

    test.dbOnly('With commit ', async () => {
        const { c, feed, snapshot } = subfixture;
        await feed.addPriceEntry({
            validator: 'somevalidator',
            token: 'SPS',
            block_num: 2,
            block_time: new Date(),
            token_price: 5,
        });
        await expect(feed.getPriceAtPoint('SPS', new Date())).resolves.toBe(5);
        snapshot.commit();
        snapshot.injectAll(c);
        const { feed: snapshotFeed } = c.resolve(SubFixture);
        await expect(snapshotFeed.getPriceAtPoint('SPS', new Date())).resolves.toBe(5);
    });

    test.dbOnly('With rollback ', async () => {
        const { c, feed, snapshot } = subfixture;
        await feed.addPriceEntry({
            validator: 'somevalidator',
            token: 'SPS',
            block_num: 2,
            block_time: new Date(),
            token_price: 6,
        });
        await expect(feed.getPriceAtPoint('SPS', new Date())).resolves.toBe(6);
        snapshot.rollback();
        await expect(feed.getPriceAtPoint('SPS', new Date())).resolves.toBe(12.7);
        snapshot.injectAll(c);
        const { feed: snapshotFeed } = c.resolve(SubFixture);
        await expect(snapshotFeed.getPriceAtPoint('SPS', new Date())).resolves.toBe(12.7);
    });
});

describe('LastBlockCache', () => {
    test.dbOnly('Without any commit ', async () => {
        const { c, lastBlockCache, snapshot } = subfixture;
        lastBlockCache.update({
            block_time: new Date(),
            block_num: 2,
            block_id: 'random-new-block-id',
        });
        expect(lastBlockCache.value).toMatchObject({ block_num: 2, block_id: 'random-new-block-id' });
        snapshot.injectAll(c);
        const { lastBlockCache: snapshotBlockCache } = c.resolve(SubFixture);
        expect(snapshotBlockCache.value).toMatchObject({ block_num: 1, block_id: 'random-block-id' });
    });

    test.dbOnly('With commit ', async () => {
        const { c, lastBlockCache, snapshot } = subfixture;
        lastBlockCache.update({
            block_time: new Date(),
            block_num: 3,
            block_id: 'random-extra-block-id',
        });
        expect(lastBlockCache.value).toMatchObject({ block_num: 3, block_id: 'random-extra-block-id' });
        snapshot.commit();
        snapshot.injectAll(c);
        const { lastBlockCache: snapshotBlockCache } = c.resolve(SubFixture);
        expect(snapshotBlockCache.value).toMatchObject({ block_num: 3, block_id: 'random-extra-block-id' });
    });

    test.dbOnly('With rollback ', async () => {
        const { c, lastBlockCache, snapshot } = subfixture;
        lastBlockCache.update({
            block_time: new Date(),
            block_num: 5,
            block_id: 'random-modern-block-id',
        });
        expect(lastBlockCache.value).toMatchObject({ block_num: 5, block_id: 'random-modern-block-id' });
        snapshot.rollback();
        expect(lastBlockCache.value).toMatchObject({ block_num: 1, block_id: 'random-block-id' });
        snapshot.injectAll(c);
        const { lastBlockCache: snapshotBlockCache } = c.resolve(SubFixture);
        expect(snapshotBlockCache.value).toMatchObject({ block_num: 1, block_id: 'random-block-id' });
    });
});
