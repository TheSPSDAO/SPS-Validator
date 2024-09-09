import { emoji_payload, garbage_payload } from '../../../__tests__/db-helpers';
import { Fixture } from '../../../__tests__/action-fixture';
import { container } from '../../../__tests__/test-composition-root';
import { PromiseEntity } from 'validator/src/db/tables';

const fixture = container.resolve(Fixture);

const promise_creator = 'AdminAccount';
const delegation_to = 'stephen';

beforeAll(async () => {
    await fixture.init();
});

beforeEach(async () => {
    await fixture.restore();
    await fixture.testHelper.setHiveAccount(promise_creator);
    await fixture.testHelper.setHiveAccount(delegation_to);
    await fixture.testHelper.insertExistingAdmins([promise_creator]);
    await fixture.loader.load();
});

afterAll(async () => {
    await fixture.dispose();
});

test.dbOnly('Garbage data for create_promise does not crash.', () => {
    return expect(fixture.opsHelper.processOp('create_promise', promise_creator, garbage_payload)).resolves.toBeUndefined();
});

test.dbOnly('Lots of emoji for create_promise does not crash.', () => {
    return expect(fixture.opsHelper.processOp('create_promise', promise_creator, emoji_payload)).resolves.toBeUndefined();
});

test.dbOnly('create_promise with invalid payload fails.', async () => {
    await expect(
        fixture.opsHelper.processOp('create_promise', promise_creator, {
            id: '1',
            type: 'delegation',
            // missing controllers / fulfill_timeout_seconds
        }),
    ).resolves.toBeUndefined();

    const result = await fixture.testHelper.getPromise('delegation', '1');
    expect(result).toBeNull();
});

test.dbOnly('create_promise with invalid type fails.', async () => {
    await expect(
        fixture.opsHelper.processOp('create_promise', promise_creator, {
            id: '1',
            type: 'invalid_type',
            controllers: [promise_creator],
            fulfill_timeout_seconds: 60_000,
        }),
    ).resolves.toBeUndefined();

    const result = await fixture.testHelper.getPromise('invalid_type', '1');
    expect(result).toBeNull();
});

// DELEGATION PROMISES

test.dbOnly.each`
    reason           | params
    no params        | ${undefined}
    negative qty     | ${{ qty: -100, token: 'SPSP', to: delegation_to }}
    no qty           | ${{ token: 'SPSP', to: delegation_to }}
    no token         | ${{ qty: 100, to: delegation_to }}
    no to            | ${{ qty: 100, token: 'SPSP' }}
    wrong token      | ${{ qty: 100, token: 'KYA', to: delegation_to }}
    invalid account  | ${{ qty: 100, token: 'KYA', to: 'invalid' }}
    with player      | ${{ qty: 100, token: 'KYA', to: delegation_to, player: 'abc' }}
`(`delegation promise invalidates case [$reason] params [$params] `, async ({ params }) => {
    await expect(
        fixture.opsHelper.processOp('create_promise', promise_creator, {
            id: '1',
            type: 'delegation',
            controllers: [promise_creator],
            fulfill_timeout_seconds: 60_000,
            params,
        }),
    ).resolves.toBeUndefined();

    const result = await fixture.testHelper.getPromise('delegation', '1');
    expect(result).toBeNull();
});

test.dbOnly('delegation promise with valid params succeeds.', async () => {
    await expect(
        fixture.opsHelper.processOp('create_promise', promise_creator, {
            id: '1',
            type: 'delegation',
            controllers: [promise_creator],
            fulfill_timeout_seconds: 60_000,
            params: { qty: 100, token: 'SPSP', to: delegation_to },
        }),
    ).resolves.toBeUndefined();

    const result = await fixture.testHelper.getPromise('delegation', '1');
    expect(result).not.toBeNull();
    expect(result).toMatchObject<Partial<PromiseEntity>>({
        type: 'delegation',
        ext_id: '1',
        controllers: [promise_creator],
        fulfill_timeout_seconds: 60_000,
        status: 'open',
        fulfilled_at: null,
        fulfilled_by: null,
        fulfilled_expiration: null,
        params: { qty: 100, token: 'SPSP', to: delegation_to },
    });
});

test.dbOnly('delegation promise with duplicate id fails.', async () => {
    await expect(
        fixture.opsHelper.processOp('create_promise', promise_creator, {
            id: '1',
            type: 'delegation',
            controllers: [promise_creator],
            fulfill_timeout_seconds: 60_000,
            params: { qty: 100, token: 'SPSP', to: delegation_to },
        }),
    ).resolves.toBeUndefined();

    await expect(
        fixture.opsHelper.processOp('create_promise', promise_creator, {
            id: '1',
            type: 'delegation',
            controllers: [promise_creator],
            fulfill_timeout_seconds: 60_000,
            params: { qty: 100, token: 'SPSP', to: delegation_to },
        }),
    ).resolves.toBeUndefined();

    const result = await fixture.testHelper.countPromises();
    expect(Number(result.count)).toBe(1);
});
