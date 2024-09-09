import { emoji_payload, garbage_payload } from '../../../__tests__/db-helpers';
import { Fixture } from '../../../__tests__/action-fixture';
import { container } from '../../../__tests__/test-composition-root';

const fixture = container.resolve(Fixture);

const test_account = 'stephen';
const test_account2 = 'random';

beforeAll(async () => {
    await fixture.init();
});

beforeEach(async () => {
    await fixture.restore();
    await fixture.testHelper.setHiveAccount(test_account);
    await fixture.testHelper.setHiveAccount(test_account2);
    await fixture.loader.load();
});

afterAll(async () => {
    await fixture.dispose();
});

test.dbOnly('Garbage data for set_authority does not crash.', () => {
    return expect(fixture.opsHelper.processOp('set_authority', test_account, garbage_payload)).resolves.toBeUndefined();
});

test.dbOnly('Lots of emoji for set_authority does not crash.', () => {
    return expect(fixture.opsHelper.processOp('set_authority', test_account, emoji_payload)).resolves.toBeUndefined();
});

test.dbOnly('Simple set_authority.', async () => {
    await expect(
        fixture.opsHelper.processOp('set_authority', test_account, {
            delegation: [test_account2],
        }),
    ).resolves.toBeUndefined();

    const result = await fixture.testHelper.getHiveAccount(test_account);
    expect(result).toBeDefined();
    expect(result?.authority).toMatchObject({ delegation: [test_account2] });
});

test.dbOnly('set_authority clears accounts.', async () => {
    await expect(
        fixture.opsHelper.processOp('set_authority', test_account, {
            delegation: [test_account2],
        }),
    ).resolves.toBeUndefined();

    await expect(
        fixture.opsHelper.processOp('set_authority', test_account, {
            delegation: [],
        }),
    ).resolves.toBeUndefined();

    const result = await fixture.testHelper.getHiveAccount(test_account);
    expect(result).toBeDefined();
    expect(result?.authority).toMatchObject({ delegation: [] });
});

test.dbOnly('set_authority fails with invalid account.', async () => {
    await expect(
        fixture.opsHelper.processOp('set_authority', test_account, {
            delegation: ['@#$%@@#$$%'],
        }),
    ).resolves.toBeUndefined();

    const result = await fixture.testHelper.getHiveAccount(test_account);
    expect(result).toBeDefined();
    expect(result?.authority).toMatchObject({});
});

test.dbOnly('set_authority fails with undefined account.', async () => {
    await expect(
        fixture.opsHelper.processOp('set_authority', test_account, {
            delegation: [undefined],
        }),
    ).resolves.toBeUndefined();

    const result = await fixture.testHelper.getHiveAccount(test_account);
    expect(result).toBeDefined();
    expect(result?.authority).toMatchObject({});
});
