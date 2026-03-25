import { Fixture } from '../../../__tests__/action-fixture';
import { container } from '../../../__tests__/test-composition-root';
import { TransitionCfg } from '../../features/transition';
import { TOKENS } from '../../features/tokens';

const fixture = container.resolve(Fixture);
let transitionPoints: TransitionCfg = null!;

const lender = 'lender_account';
const controller = 'controller_account';
const other_account = 'other_account';
const admin = 'AdminAccount';
const source_promise_id = 'source-promise-1';

beforeAll(async () => {
    await fixture.init();
});

beforeEach(async () => {
    await fixture.restore();
    await fixture.testHelper.setHiveAccount(lender);
    await fixture.testHelper.setHiveAccount(controller);
    await fixture.testHelper.setHiveAccount(other_account);
    await fixture.testHelper.setHiveAccount(admin);
    await fixture.testHelper.insertExistingAdmins([admin]);
    await fixture.loader.load();
    transitionPoints = container.resolve(TransitionCfg);
});

afterAll(async () => {
    await fixture.dispose();
});

// ─── BEFORE TRANSITION: CANNOT CREATE ─────────────────────────────────────────

describe('Before controller_creation_block transition', () => {
    const getBlockBeforeTransition = () => transitionPoints.transition_points.delegation_offer_controller_creation - 10;

    test.dbOnly('delegation_offer cannot be created before transition (even by admin)', async () => {
        const blockNum = getBlockBeforeTransition();
        await fixture.testHelper.setDummyToken(admin, 1000, TOKENS.SPSP);
        await fixture.testHelper.setStaked(admin, 1000);

        // Admin tries to create a delegation_offer - should fail with transition error
        await expect(
            fixture.opsHelper.processOp(
                'create_promise',
                admin,
                {
                    id: 'offer-1',
                    type: 'delegation_offer',
                    controllers: [controller],
                    params: {
                        token: TOKENS.SPSP,
                        qty: 100,
                        lender: admin,
                        price: 0.001,
                    },
                },
                { block_num: blockNum },
            ),
        ).resolves.toBeUndefined();

        const result = await fixture.testHelper.getPromise('delegation_offer', 'offer-1');
        expect(result).toBeNull();
    });

    test.dbOnly('non-admin lender cannot create delegation_offer before transition', async () => {
        const blockNum = getBlockBeforeTransition();
        await fixture.testHelper.setDummyToken(lender, 1000, TOKENS.SPSP);
        await fixture.testHelper.setStaked(lender, 1000);

        // Lender (non-admin) tries to create - should fail
        await expect(
            fixture.opsHelper.processOp(
                'create_promise',
                lender,
                {
                    id: 'offer-1',
                    type: 'delegation_offer',
                    controllers: [controller],
                    params: {
                        token: TOKENS.SPSP,
                        qty: 100,
                        lender: lender,
                        price: 0.001,
                    },
                },
                { block_num: blockNum },
            ),
        ).resolves.toBeUndefined();

        const result = await fixture.testHelper.getPromise('delegation_offer', 'offer-1');
        expect(result).toBeNull();
    });
});

// ─── AFTER TRANSITION: NON-ADMIN CREATION, OPTIONAL ID ──────────────────────────

describe('After controller_creation_block transition', () => {
    const getBlockAfterTransition = () => transitionPoints.transition_points.delegation_offer_controller_creation + 10;

    test.dbOnly('lender can create delegation_offer directly (non-admin)', async () => {
        const blockNum = getBlockAfterTransition();
        await fixture.testHelper.setDummyToken(lender, 1000, TOKENS.SPSP);
        await fixture.testHelper.setStaked(lender, 1000);

        await expect(
            fixture.opsHelper.processOp(
                'create_promise',
                lender,
                {
                    id: 'offer-1',
                    type: 'delegation_offer',
                    controllers: [controller],
                    params: {
                        token: TOKENS.SPSP,
                        qty: 100,
                        lender: lender,
                        price: 0.001,
                    },
                },
                { block_num: blockNum },
            ),
        ).resolves.toBeUndefined();

        const result = await fixture.testHelper.getPromise('delegation_offer', 'offer-1');
        expect(result).not.toBeNull();
        expect(result).toMatchObject({
            type: 'delegation_offer',
            ext_id: 'offer-1',
            controllers: [controller],
            status: 'open',
            params: expect.objectContaining({
                token: TOKENS.SPSP,
                qty: 100,
                lender: lender,
                qty_remaining: 100,
            }),
        });
    });

    test.dbOnly('promise ID is optional after transition (auto-generated)', async () => {
        const blockNum = getBlockAfterTransition();
        const txId = 'test-tx-123';
        await fixture.testHelper.setDummyToken(lender, 1000, TOKENS.SPSP);
        await fixture.testHelper.setStaked(lender, 1000);

        await expect(
            fixture.opsHelper.processOp(
                'create_promise',
                lender,
                {
                    id: null, // Null ID, should be auto-generated
                    type: 'delegation_offer',
                    controllers: [controller],
                    params: {
                        token: TOKENS.SPSP,
                        qty: 100,
                        lender: lender,
                        price: 0.001,
                    },
                },
                { block_num: blockNum, transaction: txId },
            ),
        ).resolves.toBeUndefined();

        // Promise should exist with auto-generated ID
        const count = await fixture.testHelper.countPromises();
        expect(Number(count.count)).toBe(1);
    });

    test.dbOnly('controller can create delegation_offer on behalf of lender with source_promise_id', async () => {
        const blockNum = getBlockAfterTransition();
        await fixture.testHelper.setDummyToken(lender, 1000, TOKENS.SPSP);
        await fixture.testHelper.setStaked(lender, 1000);

        // Insert a source promise that the controller is on
        await fixture.testHelper.insertPromise({
            type: 'delegation_offer',
            ext_id: source_promise_id,
            controllers: [controller],
            status: 'open',
            params: {
                token: TOKENS.SPSP,
                qty: 500,
                lender: lender,
                price: 0.001,
                qty_remaining: 500,
            },
            fulfill_timeout_seconds: null,
            fulfilled_at: null,
            fulfilled_by: null,
            fulfilled_expiration: null,
            created_date: new Date(),
            updated_date: new Date(),
        });

        // Controller creates a new offer on behalf of the lender
        await expect(
            fixture.opsHelper.processOp(
                'create_promise',
                controller,
                {
                    id: 'offer-2',
                    type: 'delegation_offer',
                    controllers: [controller],
                    params: {
                        token: TOKENS.SPSP,
                        qty: 100,
                        lender: lender,
                        price: 0.001,
                        source_promise_id: source_promise_id,
                    },
                },
                { block_num: blockNum },
            ),
        ).resolves.toBeUndefined();

        const result = await fixture.testHelper.getPromise('delegation_offer', 'offer-2');
        expect(result).not.toBeNull();
        expect(result).toMatchObject({
            type: 'delegation_offer',
            ext_id: 'offer-2',
            controllers: [controller],
            status: 'open',
            params: expect.objectContaining({
                token: TOKENS.SPSP,
                qty: 100,
                lender: lender,
                source_promise_id: source_promise_id,
                qty_remaining: 100,
            }),
        });
    });

    test.dbOnly('lender creation fails when lender param does not match sender', async () => {
        const blockNum = getBlockAfterTransition();
        await fixture.testHelper.setDummyToken(lender, 1000, TOKENS.SPSP);
        await fixture.testHelper.setStaked(lender, 1000);

        // Lender tries to create but specifies different account as lender
        await expect(
            fixture.opsHelper.processOp(
                'create_promise',
                lender,
                {
                    id: 'offer-1',
                    type: 'delegation_offer',
                    controllers: [controller],
                    params: {
                        token: TOKENS.SPSP,
                        qty: 100,
                        lender: other_account, // mismatch
                        price: 0.001,
                    },
                },
                { block_num: blockNum },
            ),
        ).resolves.toBeUndefined();

        const result = await fixture.testHelper.getPromise('delegation_offer', 'offer-1');
        expect(result).toBeNull();
    });

    test.dbOnly('controller creation fails without source_promise_id', async () => {
        const blockNum = getBlockAfterTransition();
        await fixture.testHelper.setDummyToken(lender, 1000, TOKENS.SPSP);
        await fixture.testHelper.setStaked(lender, 1000);

        // Controller tries to create without source_promise_id
        await expect(
            fixture.opsHelper.processOp(
                'create_promise',
                controller,
                {
                    id: 'offer-2',
                    type: 'delegation_offer',
                    controllers: [controller],
                    params: {
                        token: TOKENS.SPSP,
                        qty: 100,
                        lender: lender,
                        price: 0.001,
                        // no source_promise_id
                    },
                },
                { block_num: blockNum },
            ),
        ).resolves.toBeUndefined();

        const result = await fixture.testHelper.getPromise('delegation_offer', 'offer-2');
        expect(result).toBeNull();
    });

    test.dbOnly('controller creation fails with invalid source_promise_id', async () => {
        const blockNum = getBlockAfterTransition();
        await fixture.testHelper.setDummyToken(lender, 1000, TOKENS.SPSP);
        await fixture.testHelper.setStaked(lender, 1000);

        // Controller tries with non-existent source promise
        await expect(
            fixture.opsHelper.processOp(
                'create_promise',
                controller,
                {
                    id: 'offer-2',
                    type: 'delegation_offer',
                    controllers: [controller],
                    params: {
                        token: TOKENS.SPSP,
                        qty: 100,
                        lender: lender,
                        price: 0.001,
                        source_promise_id: 'nonexistent-promise',
                    },
                },
                { block_num: blockNum },
            ),
        ).resolves.toBeUndefined();

        const result = await fixture.testHelper.getPromise('delegation_offer', 'offer-2');
        expect(result).toBeNull();
    });

    test.dbOnly('controller creation fails when account is not a controller on source promise', async () => {
        const blockNum = getBlockAfterTransition();
        await fixture.testHelper.setDummyToken(lender, 1000, TOKENS.SPSP);
        await fixture.testHelper.setStaked(lender, 1000);

        // Insert a source promise with different controller
        await fixture.testHelper.insertPromise({
            type: 'delegation_offer',
            ext_id: source_promise_id,
            controllers: [other_account], // different controller
            status: 'open',
            params: {
                token: TOKENS.SPSP,
                qty: 500,
                lender: lender,
                price: 0.001,
                qty_remaining: 500,
            },
            fulfill_timeout_seconds: null,
            fulfilled_at: null,
            fulfilled_by: null,
            fulfilled_expiration: null,
            created_date: new Date(),
            updated_date: new Date(),
        });

        // Controller tries to create but is not a controller on the source
        await expect(
            fixture.opsHelper.processOp(
                'create_promise',
                controller,
                {
                    id: 'offer-2',
                    type: 'delegation_offer',
                    controllers: [controller],
                    params: {
                        token: TOKENS.SPSP,
                        qty: 100,
                        lender: lender,
                        price: 0.001,
                        source_promise_id: source_promise_id,
                    },
                },
                { block_num: blockNum },
            ),
        ).resolves.toBeUndefined();

        const result = await fixture.testHelper.getPromise('delegation_offer', 'offer-2');
        expect(result).toBeNull();
    });

    test.dbOnly('controller creation fails when source promise lender does not match', async () => {
        const blockNum = getBlockAfterTransition();
        await fixture.testHelper.setDummyToken(lender, 1000, TOKENS.SPSP);
        await fixture.testHelper.setStaked(lender, 1000);
        await fixture.testHelper.setDummyToken(other_account, 1000, TOKENS.SPSP);
        await fixture.testHelper.setStaked(other_account, 1000);

        // Insert a source promise with different lender
        await fixture.testHelper.insertPromise({
            type: 'delegation_offer',
            ext_id: source_promise_id,
            controllers: [controller],
            status: 'open',
            params: {
                token: TOKENS.SPSP,
                qty: 500,
                lender: other_account, // different lender
                price: 0.001,
                qty_remaining: 500,
            },
            fulfill_timeout_seconds: null,
            fulfilled_at: null,
            fulfilled_by: null,
            fulfilled_expiration: null,
            created_date: new Date(),
            updated_date: new Date(),
        });

        // Controller tries to create with mismatched lender
        await expect(
            fixture.opsHelper.processOp(
                'create_promise',
                controller,
                {
                    id: 'offer-2',
                    type: 'delegation_offer',
                    controllers: [controller],
                    params: {
                        token: TOKENS.SPSP,
                        qty: 100,
                        lender: lender, // trying to create for different lender
                        price: 0.001,
                        source_promise_id: source_promise_id,
                    },
                },
                { block_num: blockNum },
            ),
        ).resolves.toBeUndefined();

        const result = await fixture.testHelper.getPromise('delegation_offer', 'offer-2');
        expect(result).toBeNull();
    });

    test.dbOnly('delegation_offer fails with non-null fulfill_timeout_seconds', async () => {
        const blockNum = getBlockAfterTransition();
        await fixture.testHelper.setDummyToken(lender, 1000, TOKENS.SPSP);
        await fixture.testHelper.setStaked(lender, 1000);

        // Lender tries to create with fulfill_timeout_seconds set
        await expect(
            fixture.opsHelper.processOp(
                'create_promise',
                lender,
                {
                    id: 'offer-1',
                    type: 'delegation_offer',
                    controllers: [controller],
                    fulfill_timeout_seconds: 60_000, // not allowed for delegation_offer
                    params: {
                        token: TOKENS.SPSP,
                        qty: 100,
                        lender: lender,
                        price: 0.001,
                    },
                },
                { block_num: blockNum },
            ),
        ).resolves.toBeUndefined();

        const result = await fixture.testHelper.getPromise('delegation_offer', 'offer-1');
        expect(result).toBeNull();
    });
});

// ─── VALIDATION TESTS (after transition) ────────────────────────────────────────

describe('delegation_offer parameter validation', () => {
    const getBlockAfterTransition = () => transitionPoints.transition_points.delegation_offer_controller_creation + 10;

    test.dbOnly('delegation_offer fails with missing token', async () => {
        const blockNum = getBlockAfterTransition();
        await fixture.testHelper.setDummyToken(lender, 1000, TOKENS.SPSP);
        await fixture.testHelper.setStaked(lender, 1000);

        await expect(
            fixture.opsHelper.processOp(
                'create_promise',
                lender,
                {
                    id: 'offer-1',
                    type: 'delegation_offer',
                    controllers: [controller],
                    params: {
                        qty: 100,
                        lender: lender,
                        price: 0.001,
                    },
                },
                { block_num: blockNum },
            ),
        ).resolves.toBeUndefined();

        const result = await fixture.testHelper.getPromise('delegation_offer', 'offer-1');
        expect(result).toBeNull();
    });

    test.dbOnly('delegation_offer fails with missing qty', async () => {
        const blockNum = getBlockAfterTransition();
        await fixture.testHelper.setDummyToken(lender, 1000, TOKENS.SPSP);
        await fixture.testHelper.setStaked(lender, 1000);

        await expect(
            fixture.opsHelper.processOp(
                'create_promise',
                lender,
                {
                    id: 'offer-1',
                    type: 'delegation_offer',
                    controllers: [controller],
                    params: {
                        token: TOKENS.SPSP,
                        lender: lender,
                        price: 0.001,
                    },
                },
                { block_num: blockNum },
            ),
        ).resolves.toBeUndefined();

        const result = await fixture.testHelper.getPromise('delegation_offer', 'offer-1');
        expect(result).toBeNull();
    });

    test.dbOnly('delegation_offer fails with missing lender', async () => {
        const blockNum = getBlockAfterTransition();
        await fixture.testHelper.setDummyToken(lender, 1000, TOKENS.SPSP);
        await fixture.testHelper.setStaked(lender, 1000);

        await expect(
            fixture.opsHelper.processOp(
                'create_promise',
                lender,
                {
                    id: 'offer-1',
                    type: 'delegation_offer',
                    controllers: [controller],
                    params: {
                        token: TOKENS.SPSP,
                        qty: 100,
                        price: 0.001,
                    },
                },
                { block_num: blockNum },
            ),
        ).resolves.toBeUndefined();

        const result = await fixture.testHelper.getPromise('delegation_offer', 'offer-1');
        expect(result).toBeNull();
    });

    test.dbOnly('delegation_offer fails with missing price', async () => {
        const blockNum = getBlockAfterTransition();
        await fixture.testHelper.setDummyToken(lender, 1000, TOKENS.SPSP);
        await fixture.testHelper.setStaked(lender, 1000);

        await expect(
            fixture.opsHelper.processOp(
                'create_promise',
                lender,
                {
                    id: 'offer-1',
                    type: 'delegation_offer',
                    controllers: [controller],
                    params: {
                        token: TOKENS.SPSP,
                        qty: 100,
                        lender: lender,
                    },
                },
                { block_num: blockNum },
            ),
        ).resolves.toBeUndefined();

        const result = await fixture.testHelper.getPromise('delegation_offer', 'offer-1');
        expect(result).toBeNull();
    });

    test.dbOnly('delegation_offer fails with negative qty', async () => {
        const blockNum = getBlockAfterTransition();
        await fixture.testHelper.setDummyToken(lender, 1000, TOKENS.SPSP);
        await fixture.testHelper.setStaked(lender, 1000);

        await expect(
            fixture.opsHelper.processOp(
                'create_promise',
                lender,
                {
                    id: 'offer-1',
                    type: 'delegation_offer',
                    controllers: [controller],
                    params: {
                        token: TOKENS.SPSP,
                        qty: -100,
                        lender: lender,
                        price: 0.001,
                    },
                },
                { block_num: blockNum },
            ),
        ).resolves.toBeUndefined();

        const result = await fixture.testHelper.getPromise('delegation_offer', 'offer-1');
        expect(result).toBeNull();
    });

    test.dbOnly('delegation_offer fails with invalid token', async () => {
        const blockNum = getBlockAfterTransition();
        await fixture.testHelper.setDummyToken(lender, 1000, TOKENS.SPSP);
        await fixture.testHelper.setStaked(lender, 1000);

        await expect(
            fixture.opsHelper.processOp(
                'create_promise',
                lender,
                {
                    id: 'offer-1',
                    type: 'delegation_offer',
                    controllers: [controller],
                    params: {
                        token: 'INVALID_TOKEN',
                        qty: 100,
                        lender: lender,
                        price: 0.001,
                    },
                },
                { block_num: blockNum },
            ),
        ).resolves.toBeUndefined();

        const result = await fixture.testHelper.getPromise('delegation_offer', 'offer-1');
        expect(result).toBeNull();
    });
});
