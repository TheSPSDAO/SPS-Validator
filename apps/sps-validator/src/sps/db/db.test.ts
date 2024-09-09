import { container } from '../../__tests__/test-composition-root';
import { inject, injectable } from 'tsyringe';
import { Fixture as BaseFixture } from '../../__tests__/fixture';
import { HiveAccountEntity, TransactionStarter } from '@steem-monsters/splinterlands-validator';

@injectable()
class Fixture extends BaseFixture {
    constructor(@inject(TransactionStarter) readonly transactionStarter: TransactionStarter) {
        super();
    }
}

const fixture = container.resolve(Fixture);

beforeAll(async () => {
    await fixture.init();
});

beforeEach(async () => {
    await fixture.restore();
});

afterAll(async () => {
    await fixture.dispose();
});

test.dbOnly('Normal transaction is committed', async () => {
    const payload = { name: 'hello', authority: {} };
    const beforeAccounts = await fixture.handle.query(HiveAccountEntity).getMany();
    await fixture.transactionStarter.withTransaction(async (trx) => {
        await fixture.handle.query(HiveAccountEntity).transacting(trx).insertItem(payload);
    });
    const afterAccounts = await fixture.handle.query(HiveAccountEntity).getMany();
    expect(beforeAccounts).toStrictEqual([]);
    expect(afterAccounts).toStrictEqual([payload]);
});

test.dbOnly('Using committed transaction throws', async () => {
    const trx = await fixture.transactionStarter.beginTransaction();
    await trx.commit();
    await expect(fixture.handle!.query(HiveAccountEntity).transacting(trx).getFirstOrNull()).rejects.toBeInstanceOf(Error);
});

test.dbOnly('Using rolled back transaction throws', async () => {
    const trx = await fixture.transactionStarter.beginTransaction();
    await trx.rollback();
    await expect(fixture.handle.query(HiveAccountEntity).transacting(trx).getFirstOrNull()).rejects.toBeInstanceOf(Error);
});

// Weird interaction between knex and a bug pg-mem, that makes rollbacks not work
// Verified to work on actual databases fine though!
test.dbOnly.skip('Manual transaction rollback is rolled back', async () => {
    const payload = { name: 'hello', authority: {} };
    const trx = await fixture.transactionStarter.beginTransaction();
    const beforeAccounts = await fixture.handle!.query(HiveAccountEntity).transacting(trx).getMany();
    await fixture.handle!.query(HiveAccountEntity).transacting(trx).insertItem(payload);
    const inTransactionAccounts = await fixture.handle.query(HiveAccountEntity).transacting(trx).getMany();
    expect(inTransactionAccounts).toStrictEqual([payload]);
    await trx.rollback();
    const afterAccounts = await fixture.handle.query(HiveAccountEntity).getMany();
    expect(beforeAccounts).toStrictEqual([]);
    expect(afterAccounts).toStrictEqual([]);
});

test.dbOnly('Broken transaction is reverted, and throws.', async () => {
    const error = new Error('Random error during transaction processing!');
    await expect(
        fixture.transactionStarter.withTransaction(async (_trx) => {
            throw error;
        }),
    ).rejects.toBe(error);
});
