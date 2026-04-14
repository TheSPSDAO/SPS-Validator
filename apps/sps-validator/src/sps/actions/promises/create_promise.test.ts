import { emoji_payload, garbage_payload } from '../../../__tests__/db-helpers';
import { Fixture } from '../../../__tests__/action-fixture';
import { container } from '../../../__tests__/test-composition-root';
import { PromiseEntity } from 'validator/src/db/tables';
import { TransitionCfg } from '../../features/transition';
import { TOKENS } from '../../features/tokens';

const fixture = container.resolve(Fixture);
let transitionPoints: TransitionCfg = null!;

const promise_creator = 'AdminAccount';
const delegation_to = 'stephen';
const non_admin = 'notadmin';

beforeAll(async () => {
    await fixture.init();
});

beforeEach(async () => {
    await fixture.restore();
    await fixture.testHelper.setHiveAccount(promise_creator);
    await fixture.testHelper.setHiveAccount(delegation_to);
    await fixture.testHelper.setHiveAccount(non_admin);
    await fixture.testHelper.insertExistingAdmins([promise_creator]);
    await fixture.testHelper.insertDefaultConfiguration();
    await fixture.loader.load();
    transitionPoints = container.resolve(TransitionCfg);
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

// ─── ACTION TRANSITION TESTS ────────────────────────────────────────────────────

describe('Before delegation_offer_block transition', () => {
    const getBlockBeforeTransition = () => transitionPoints.transition_points.delegation_offer_block - 10;

    test.dbOnly('create_promise requires admin before transition', async () => {
        const blockNum = getBlockBeforeTransition();

        // Non-admin should fail
        await expect(
            fixture.opsHelper.processOp(
                'create_promise',
                non_admin,
                {
                    id: '1',
                    type: 'delegation',
                    controllers: [promise_creator],
                    fulfill_timeout_seconds: 60_000,
                    params: { qty: 100, token: 'SPSP', to: delegation_to },
                },
                { block_num: blockNum },
            ),
        ).resolves.toBeUndefined();

        const result = await fixture.testHelper.getPromise('delegation', '1');
        expect(result).toBeNull();
    });

    test.dbOnly('create_promise requires id before transition', async () => {
        const blockNum = getBlockBeforeTransition();

        // Admin but with null id should fail (schema requires it)
        await expect(
            fixture.opsHelper.processOp(
                'create_promise',
                promise_creator,
                {
                    id: null,
                    type: 'delegation',
                    controllers: [promise_creator],
                    fulfill_timeout_seconds: 60_000,
                    params: { qty: 100, token: 'SPSP', to: delegation_to },
                },
                { block_num: blockNum },
            ),
        ).resolves.toBeUndefined();

        const count = await fixture.testHelper.countPromises();
        expect(Number(count.count)).toBe(0);
    });

    test.dbOnly('create_promise without id property fails before transition', async () => {
        const blockNum = getBlockBeforeTransition();

        // Admin but missing id property should fail
        await expect(
            fixture.opsHelper.processOp(
                'create_promise',
                promise_creator,
                {
                    // id is missing
                    type: 'delegation',
                    controllers: [promise_creator],
                    fulfill_timeout_seconds: 60_000,
                    params: { qty: 100, token: 'SPSP', to: delegation_to },
                },
                { block_num: blockNum },
            ),
        ).resolves.toBeUndefined();

        const count = await fixture.testHelper.countPromises();
        expect(Number(count.count)).toBe(0);
    });

    test.dbOnly('admin can create promise with id before transition', async () => {
        const blockNum = getBlockBeforeTransition();

        await expect(
            fixture.opsHelper.processOp(
                'create_promise',
                promise_creator,
                {
                    id: 'my-promise-id',
                    type: 'delegation',
                    controllers: [promise_creator],
                    fulfill_timeout_seconds: 60_000,
                    params: { qty: 100, token: 'SPSP', to: delegation_to },
                },
                { block_num: blockNum },
            ),
        ).resolves.toBeUndefined();

        const result = await fixture.testHelper.getPromise('delegation', 'my-promise-id');
        expect(result).not.toBeNull();
        expect(result?.ext_id).toBe('my-promise-id');
    });
});

describe('After delegation_offer_block transition', () => {
    const getBlockAfterTransition = () => transitionPoints.transition_points.delegation_offer_block + 10;

    test.dbOnly('create_promise with null id for delegation_offer type auto-generates id', async () => {
        const blockNum = getBlockAfterTransition();
        await fixture.testHelper.setStaked(non_admin, 1000);

        await expect(
            fixture.opsHelper.processOp(
                'create_promise',
                non_admin,
                {
                    id: null,
                    type: 'delegation_offer',
                    controllers: [promise_creator],
                    params: {
                        token: TOKENS.SPSP,
                        qty: 100,
                        lender: non_admin,
                        price: 0.001,
                    },
                },
                { block_num: blockNum },
            ),
        ).resolves.toBeUndefined();

        const count = await fixture.testHelper.countPromises();
        expect(Number(count.count)).toBe(1);
    });

    test.dbOnly('create_promise without id property for delegation_offer type auto-generates id', async () => {
        const blockNum = getBlockAfterTransition();
        await fixture.testHelper.setStaked(non_admin, 1000);

        await expect(
            fixture.opsHelper.processOp(
                'create_promise',
                non_admin,
                {
                    // id property is omitted
                    type: 'delegation_offer',
                    controllers: [promise_creator],
                    params: {
                        token: TOKENS.SPSP,
                        qty: 100,
                        lender: non_admin,
                        price: 0.001,
                    },
                },
                { block_num: blockNum },
            ),
        ).resolves.toBeUndefined();

        const count = await fixture.testHelper.countPromises();
        expect(Number(count.count)).toBe(1);
    });

    test.dbOnly('create_promise with provided id does not work after transition', async () => {
        const blockNum = getBlockAfterTransition();
        await fixture.testHelper.setStaked(non_admin, 1000);

        await expect(
            fixture.opsHelper.processOp(
                'create_promise',
                non_admin,
                {
                    id: 'custom-id',
                    type: 'delegation_offer',
                    controllers: [promise_creator],
                    params: {
                        token: TOKENS.SPSP,
                        qty: 100,
                        lender: non_admin,
                        price: 0.001,
                    },
                },
                { block_num: blockNum },
            ),
        ).resolves.toBeUndefined();

        const result = await fixture.testHelper.getPromise('delegation_offer', 'custom-id');
        expect(result).toBeNull();
    });

    test.dbOnly('non-admin can create delegation_offer promise after transition', async () => {
        const blockNum = getBlockAfterTransition();
        const txId = 'tx-non-admin-offer';
        await fixture.testHelper.setStaked(non_admin, 1000);

        await expect(
            fixture.opsHelper.processOp(
                'create_promise',
                non_admin,
                {
                    type: 'delegation_offer',
                    controllers: [promise_creator],
                    params: {
                        token: TOKENS.SPSP,
                        qty: 500,
                        lender: non_admin,
                        price: 0.001,
                    },
                },
                { block_num: blockNum, transaction: txId },
            ),
        ).resolves.toBeUndefined();

        const result = await fixture.testHelper.getPromise('delegation_offer', txId);
        expect(result).not.toBeNull();
        expect(result?.status).toBe('open');
    });

    test.dbOnly('delegation promise still requires admin after transition', async () => {
        const blockNum = getBlockAfterTransition();

        // Non-admin trying to create delegation (not delegation_offer) should fail
        // because delegation promises still require admin
        await expect(
            fixture.opsHelper.processOp(
                'create_promise',
                non_admin,
                {
                    id: 'delegation-1',
                    type: 'delegation',
                    controllers: [promise_creator],
                    fulfill_timeout_seconds: 60_000,
                    params: { qty: 100, token: 'SPSP', to: delegation_to },
                },
                { block_num: blockNum },
            ),
        ).resolves.toBeUndefined();

        const result = await fixture.testHelper.getPromise('delegation', 'delegation-1');
        expect(result).toBeNull();
    });

    test.dbOnly('delegation promise without fulfill_timeout_seconds fails after transition', async () => {
        const blockNum = getBlockAfterTransition();

        // The new schema makes fulfill_timeout_seconds optional, but the delegation
        // handler still requires it. This test ensures the handler-level validation
        // catches the missing field even though the schema allows it.
        await expect(
            fixture.opsHelper.processOp(
                'create_promise',
                promise_creator,
                {
                    id: 'delegation-no-timeout',
                    type: 'delegation',
                    controllers: [promise_creator],
                    params: { qty: 100, token: 'SPSP', to: delegation_to },
                },
                { block_num: blockNum },
            ),
        ).resolves.toBeUndefined();

        const result = await fixture.testHelper.getPromise('delegation', 'delegation-no-timeout');
        expect(result).toBeNull();
    });
});
