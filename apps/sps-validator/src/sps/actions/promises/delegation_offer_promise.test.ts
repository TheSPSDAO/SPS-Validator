import { Fixture } from '../../../__tests__/action-fixture';
import { container } from '../../../__tests__/test-composition-root';
import { TransitionCfg } from '../../features/transition';
import { TOKENS } from '../../features/tokens';

const fixture = container.resolve(Fixture);
let transitionPoints: TransitionCfg = null!;

const lender = 'lender';
const controller = 'controller';
const borrower = 'borrower';
const other_account = 'other';
const admin = 'admin';
const source_promise_id = 'source-promise-1';

beforeAll(async () => {
    await fixture.init();
});

beforeEach(async () => {
    await fixture.restore();
    await fixture.testHelper.setHiveAccount(lender);
    await fixture.testHelper.setHiveAccount(controller);
    await fixture.testHelper.setHiveAccount(borrower);
    await fixture.testHelper.setHiveAccount(other_account);
    await fixture.testHelper.setHiveAccount(admin);
    await fixture.testHelper.insertExistingAdmins([admin]);
    await fixture.testHelper.insertDefaultConfiguration();
    await fixture.loader.load();
    transitionPoints = container.resolve(TransitionCfg);
});

afterAll(async () => {
    await fixture.dispose();
});

// ─── BEFORE TRANSITION: CANNOT CREATE ─────────────────────────────────────────

describe('Before controller_creation_block transition', () => {
    const getBlockBeforeTransition = () => transitionPoints.transition_points.delegation_offer_block - 10;

    test.dbOnly('delegation_offer cannot be created before transition (even by admin)', async () => {
        const blockNum = getBlockBeforeTransition();
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
    const getBlockAfterTransition = () => transitionPoints.transition_points.delegation_offer_block + 10;

    test.dbOnly('lender can create delegation_offer directly (non-admin)', async () => {
        const blockNum = getBlockAfterTransition();
        const txId = 'tx-offer-1';
        await fixture.testHelper.setStaked(lender, 1000);

        await expect(
            fixture.opsHelper.processOp(
                'create_promise',
                lender,
                {
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

        const result = await fixture.testHelper.getPromise('delegation_offer', txId);
        expect(result).not.toBeNull();
        expect(result).toMatchObject({
            type: 'delegation_offer',
            ext_id: txId,
            controllers: [controller],
            status: 'open',
            params: {
                token: TOKENS.SPSP,
                qty: 100,
                lender: lender,
                price: 0.001,
                qty_remaining: 100,
            },
        });
    });

    test.dbOnly('promise ID is optional after transition (auto-generated)', async () => {
        const blockNum = getBlockAfterTransition();
        const txId = 'test-tx-123';
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
        const txId = 'tx-offer-2';
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
                { block_num: blockNum, transaction: txId },
            ),
        ).resolves.toBeUndefined();

        const result = await fixture.testHelper.getPromise('delegation_offer', txId);
        expect(result).not.toBeNull();
        expect(result).toMatchObject({
            type: 'delegation_offer',
            ext_id: txId,
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
        await fixture.testHelper.setStaked(lender, 1000);
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
    const getBlockAfterTransition = () => transitionPoints.transition_points.delegation_offer_block + 10;

    test.dbOnly('delegation_offer fails with missing token', async () => {
        const blockNum = getBlockAfterTransition();
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

    test.dbOnly('delegation_offer fails when qty is not a multiple of 500', async () => {
        const blockNum = getBlockAfterTransition();
        await fixture.loader.update({
            group_name: 'delegation_rental',
            name: 'qty_divisor',
            value: 500,
        });
        await fixture.testHelper.setStaked(lender, 1000);

        const txId = 'tx-offer-not-divisible';
        await expect(
            fixture.opsHelper.processOp(
                'create_promise',
                lender,
                {
                    type: 'delegation_offer',
                    controllers: [controller],
                    params: {
                        token: TOKENS.SPSP,
                        qty: 250,
                        lender: lender,
                        price: 0.001,
                    },
                },
                { block_num: blockNum, transaction: txId },
            ),
        ).resolves.toBeUndefined();

        const result = await fixture.testHelper.getPromise('delegation_offer', txId);
        expect(result).toBeNull();
    });

    test.dbOnly('delegation_offer succeeds when qty is a multiple of 500', async () => {
        const blockNum = getBlockAfterTransition();
        await fixture.loader.update({
            group_name: 'delegation_rental',
            name: 'qty_divisor',
            value: 500,
        });
        await fixture.testHelper.setStaked(lender, 1000);

        const txId = 'tx-offer-1';
        await expect(
            fixture.opsHelper.processOp(
                'create_promise',
                lender,
                {
                    type: 'delegation_offer',
                    controllers: [controller],
                    params: {
                        token: TOKENS.SPSP,
                        qty: 500,
                        lender: lender,
                        price: 0.001,
                    },
                },
                { block_num: blockNum, transaction: txId },
            ),
        ).resolves.toBeUndefined();

        const result = await fixture.testHelper.getPromise('delegation_offer', txId);
        expect(result).not.toBeNull();
        expect(result!.status).toBe('open');
    });
});

// ─── CREATE + FULFILL SUCCESS ──────────────────────────────────────────────────

describe('delegation_offer create and fulfill', () => {
    const getBlockAfterTransition = () => transitionPoints.transition_points.delegation_offer_block + 10;

    test.dbOnly('create locks SPSP into system account, fulfill delegates to borrower and creates rental record', async () => {
        const blockNum = getBlockAfterTransition();
        const txId = 'tx-create-fulfill';
        await fixture.testHelper.setStaked(lender, 1000);

        // Create the offer
        await fixture.opsHelper.processOp(
            'create_promise',
            lender,
            {
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
        );

        // Verify SPSP was locked: lender has 100 SPSP_OUT delegated, system account has 100 SPSP_IN
        const lenderOut = await fixture.testHelper.getDummyToken(lender, TOKENS.SPSP_OUT);
        expect(lenderOut?.balance).toBe(100);
        const sysIn = await fixture.testHelper.getDummyToken('$DELEGATION_PROMISES', TOKENS.SPSP_IN);
        expect(sysIn?.balance).toBe(100);

        // Fulfill the offer fully
        await fixture.opsHelper.processOp(
            'fulfill_promise',
            controller,
            {
                id: txId,
                type: 'delegation_offer',
                metadata: {
                    borrower: borrower,
                    rental_id: 'rental-1',
                    qty: 100,
                    expiration_blocks: 100000,
                },
            },
            { block_num: blockNum + 1 },
        );

        // Promise should be completed (fully filled)
        const promise = await fixture.testHelper.getPromise('delegation_offer', txId);
        expect(promise).not.toBeNull();
        expect(promise!.status).toBe('completed');
        expect((promise!.params as any).qty_remaining).toBe(0);

        // System account should have 0 SPSP_IN (unlocked back to lender, then lender delegated to borrower)
        const sysInAfter = await fixture.testHelper.getDummyToken('$DELEGATION_PROMISES', TOKENS.SPSP_IN);
        expect(sysInAfter?.balance ?? 0).toBe(0);

        // Lender still has 100 SPSP_OUT (now delegated to borrower instead of system account)
        const lenderOutAfter = await fixture.testHelper.getDummyToken(lender, TOKENS.SPSP_OUT);
        expect(lenderOutAfter?.balance).toBe(100);

        // Borrower has 100 SPSP_IN
        const borrowerIn = await fixture.testHelper.getDummyToken(borrower, TOKENS.SPSP_IN);
        expect(borrowerIn?.balance).toBe(100);

        // Rental delegation record was created
        const rental = await fixture.testHelper.getRentalDelegation('rental-1');
        expect(rental).not.toBeNull();
        expect(rental).toMatchObject({
            id: 'rental-1',
            promise_type: 'delegation_offer',
            promise_ext_id: txId,
            lender: lender,
            borrower: borrower,
            token: TOKENS.SPSP,
            status: 'active',
        });
        expect(parseFloat(rental!.qty)).toBe(100);
    });

    test.dbOnly('fulfill writes a history record', async () => {
        const blockNum = getBlockAfterTransition();
        const txId = 'tx-history';
        await fixture.testHelper.setStaked(lender, 1000);

        await fixture.opsHelper.processOp(
            'create_promise',
            lender,
            {
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
        );

        await fixture.opsHelper.processOp(
            'fulfill_promise',
            controller,
            {
                id: txId,
                type: 'delegation_offer',
                metadata: {
                    borrower: borrower,
                    rental_id: 'rental-1',
                    qty: 100,
                    expiration_blocks: 100000,
                },
            },
            { block_num: blockNum + 1 },
        );

        const promise = await fixture.testHelper.getPromise('delegation_offer', txId);
        const history = await fixture.testHelper.getPromiseHistory(promise!.id);
        // Should have at least a create and a fulfill record
        expect(history.length).toBeGreaterThanOrEqual(2);
        const fulfillHistory = history.find((h) => h.action === 'fulfill' || h.action === 'complete');
        expect(fulfillHistory).toBeDefined();
        expect(fulfillHistory!.player).toBe(controller);
    });
});

// ─── PARTIAL FILLS ─────────────────────────────────────────────────────────────

describe('delegation_offer partial fills', () => {
    const getBlockAfterTransition = () => transitionPoints.transition_points.delegation_offer_block + 10;

    test.dbOnly('partial fill keeps promise open and decrements qty_remaining', async () => {
        const blockNum = getBlockAfterTransition();
        const txId = 'tx-partial-1';
        await fixture.testHelper.setStaked(lender, 1000);

        // Create offer for 100 SPSP
        await fixture.opsHelper.processOp(
            'create_promise',
            lender,
            {
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
        );

        // Fill 40 of 100
        await fixture.opsHelper.processOp(
            'fulfill_promise',
            controller,
            {
                id: txId,
                type: 'delegation_offer',
                metadata: {
                    borrower: borrower,
                    rental_id: 'rental-1',
                    qty: 40,
                    expiration_blocks: 100000,
                },
            },
            { block_num: blockNum + 1 },
        );

        // Promise should still be open with 60 remaining
        const promise = await fixture.testHelper.getPromise('delegation_offer', txId);
        expect(promise!.status).toBe('open');
        expect((promise!.params as any).qty_remaining).toBe(60);

        // System account has 60 SPSP_IN remaining (100 - 40)
        const sysIn = await fixture.testHelper.getDummyToken('$DELEGATION_PROMISES', TOKENS.SPSP_IN);
        expect(sysIn?.balance).toBe(60);

        // Borrower has 40 SPSP_IN
        const borrowerIn = await fixture.testHelper.getDummyToken(borrower, TOKENS.SPSP_IN);
        expect(borrowerIn?.balance).toBe(40);

        // Rental record created for 40
        const rental = await fixture.testHelper.getRentalDelegation('rental-1');
        expect(rental).not.toBeNull();
        expect(parseFloat(rental!.qty)).toBe(40);
        expect(rental!.status).toBe('active');
    });

    test.dbOnly('partial fill writes a history record even though status stays open', async () => {
        const blockNum = getBlockAfterTransition();
        const txId = 'tx-partial-history';
        await fixture.testHelper.setStaked(lender, 1000);

        await fixture.opsHelper.processOp(
            'create_promise',
            lender,
            {
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
        );

        await fixture.opsHelper.processOp(
            'fulfill_promise',
            controller,
            {
                id: txId,
                type: 'delegation_offer',
                metadata: {
                    borrower: borrower,
                    rental_id: 'rental-1',
                    qty: 40,
                    expiration_blocks: 100000,
                },
            },
            { block_num: blockNum + 1 },
        );

        const promise = await fixture.testHelper.getPromise('delegation_offer', txId);
        const history = await fixture.testHelper.getPromiseHistory(promise!.id);
        const fulfillHistory = history.find((h) => h.action === 'fulfill');
        expect(fulfillHistory).toBeDefined();
        expect(fulfillHistory!.player).toBe(controller);
        expect(fulfillHistory!.previous_status).toBe('open');
        expect(fulfillHistory!.new_status).toBe('open');
    });

    test.dbOnly('multiple partial fills then final fill completes the promise', async () => {
        const blockNum = getBlockAfterTransition();
        const txId = 'tx-multi-fill';
        const borrower2 = 'borrower2';
        await fixture.testHelper.setHiveAccount(borrower2);
        await fixture.testHelper.setStaked(lender, 1000);

        // Create offer for 100 SPSP
        await fixture.opsHelper.processOp(
            'create_promise',
            lender,
            {
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
        );

        // Fill 1: 30 to borrower
        await fixture.opsHelper.processOp(
            'fulfill_promise',
            controller,
            {
                id: txId,
                type: 'delegation_offer',
                metadata: {
                    borrower: borrower,
                    rental_id: 'rental-1',
                    qty: 30,
                    expiration_blocks: 100000,
                },
            },
            { block_num: blockNum + 1 },
        );

        let promise = await fixture.testHelper.getPromise('delegation_offer', txId);
        expect(promise!.status).toBe('open');
        expect((promise!.params as any).qty_remaining).toBe(70);

        // Fill 2: 30 to borrower2
        await fixture.opsHelper.processOp(
            'fulfill_promise',
            controller,
            {
                id: txId,
                type: 'delegation_offer',
                metadata: {
                    borrower: borrower2,
                    rental_id: 'rental-2',
                    qty: 30,
                    expiration_blocks: 100000,
                },
            },
            { block_num: blockNum + 2 },
        );

        promise = await fixture.testHelper.getPromise('delegation_offer', txId);
        expect(promise!.status).toBe('open');
        expect((promise!.params as any).qty_remaining).toBe(40);

        // Fill 3: remaining 40 to borrower
        await fixture.opsHelper.processOp(
            'fulfill_promise',
            controller,
            {
                id: txId,
                type: 'delegation_offer',
                metadata: {
                    borrower: borrower,
                    rental_id: 'rental-3',
                    qty: 40,
                    expiration_blocks: 100000,
                },
            },
            { block_num: blockNum + 3 },
        );

        // Now the promise should be completed
        promise = await fixture.testHelper.getPromise('delegation_offer', txId);
        expect(promise!.status).toBe('completed');
        expect((promise!.params as any).qty_remaining).toBe(0);

        // System account should have 0 SPSP_IN
        const sysIn = await fixture.testHelper.getDummyToken('$DELEGATION_PROMISES', TOKENS.SPSP_IN);
        expect(sysIn?.balance ?? 0).toBe(0);

        // borrower has 70 SPSP_IN (30 + 40)
        const borrowerIn = await fixture.testHelper.getDummyToken(borrower, TOKENS.SPSP_IN);
        expect(borrowerIn?.balance).toBe(70);

        // borrower2 has 30 SPSP_IN
        const borrower2In = await fixture.testHelper.getDummyToken(borrower2, TOKENS.SPSP_IN);
        expect(borrower2In?.balance).toBe(30);

        // Three rental records exist
        const rentals = await fixture.testHelper.getRentalDelegationsByPromise('delegation_offer', txId);
        expect(rentals.length).toBe(3);
    });

    test.dbOnly('fill qty exceeding remaining is rejected', async () => {
        const blockNum = getBlockAfterTransition();
        const txId = 'tx-exceed';
        await fixture.testHelper.setStaked(lender, 1000);

        await fixture.opsHelper.processOp(
            'create_promise',
            lender,
            {
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
        );

        // Fill 60
        await fixture.opsHelper.processOp(
            'fulfill_promise',
            controller,
            {
                id: txId,
                type: 'delegation_offer',
                metadata: {
                    borrower: borrower,
                    rental_id: 'rental-1',
                    qty: 60,
                    expiration_blocks: 100000,
                },
            },
            { block_num: blockNum + 1 },
        );

        // Try to fill 50 (only 40 remaining) — should fail
        await fixture.opsHelper.processOp(
            'fulfill_promise',
            controller,
            {
                id: txId,
                type: 'delegation_offer',
                metadata: {
                    borrower: borrower,
                    rental_id: 'rental-2',
                    qty: 50,
                    expiration_blocks: 100000,
                },
            },
            { block_num: blockNum + 2 },
        );

        // Promise should still be open with 40 remaining
        const promise = await fixture.testHelper.getPromise('delegation_offer', txId);
        expect(promise!.status).toBe('open');
        expect((promise!.params as any).qty_remaining).toBe(40);

        // Should not have created the second rental
        const rental2 = await fixture.testHelper.getRentalDelegation('rental-2');
        expect(rental2).toBeNull();
    });

    test.dbOnly('duplicate rental_id is rejected', async () => {
        const blockNum = getBlockAfterTransition();
        const txId = 'tx-dup-rental';
        await fixture.testHelper.setStaked(lender, 1000);

        await fixture.opsHelper.processOp(
            'create_promise',
            lender,
            {
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
        );

        // Fill with rental-1
        await fixture.opsHelper.processOp(
            'fulfill_promise',
            controller,
            {
                id: txId,
                type: 'delegation_offer',
                metadata: {
                    borrower: borrower,
                    rental_id: 'rental-1',
                    qty: 40,
                    expiration_blocks: 100000,
                },
            },
            { block_num: blockNum + 1 },
        );

        // Try again with same rental_id — should fail
        await fixture.opsHelper.processOp(
            'fulfill_promise',
            controller,
            {
                id: txId,
                type: 'delegation_offer',
                metadata: {
                    borrower: borrower,
                    rental_id: 'rental-1',
                    qty: 30,
                    expiration_blocks: 100000,
                },
            },
            { block_num: blockNum + 2 },
        );

        // qty_remaining should still be 60 (only the first fill succeeded)
        const promise = await fixture.testHelper.getPromise('delegation_offer', txId);
        expect((promise!.params as any).qty_remaining).toBe(60);
    });
});

// ─── CANCEL ────────────────────────────────────────────────────────────────────

describe('delegation_offer cancel', () => {
    const getBlockAfterTransition = () => transitionPoints.transition_points.delegation_offer_block + 10;

    test.dbOnly('only lender can cancel delegation_offer (controller cannot)', async () => {
        const blockNum = getBlockAfterTransition();
        const txId = 'tx-cancel-auth';
        await fixture.testHelper.setStaked(lender, 1000);

        // Create offer for 100 SPSP
        await fixture.opsHelper.processOp(
            'create_promise',
            lender,
            {
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
        );

        // Controller tries to cancel - should fail
        await fixture.opsHelper.processOp(
            'cancel_promise',
            controller,
            {
                id: txId,
                type: 'delegation_offer',
            },
            { block_num: blockNum + 1 },
        );

        // Promise should still be open (cancel was rejected)
        const promise = await fixture.testHelper.getPromise('delegation_offer', txId);
        expect(promise!.status).toBe('open');
    });

    test.dbOnly('cancel unfilled promise returns all SPSP to lender', async () => {
        const blockNum = getBlockAfterTransition();
        const txId = 'tx-cancel-unfilled';
        await fixture.testHelper.setStaked(lender, 1000);

        // Create offer for 100 SPSP
        await fixture.opsHelper.processOp(
            'create_promise',
            lender,
            {
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
        );

        // Verify lender has 100 SPSP_OUT locked
        let lenderOut = await fixture.testHelper.getDummyToken(lender, TOKENS.SPSP_OUT);
        expect(lenderOut?.balance).toBe(100);

        // Cancel the promise (must be lender)
        await fixture.opsHelper.processOp(
            'cancel_promise',
            lender,
            {
                id: txId,
                type: 'delegation_offer',
            },
            { block_num: blockNum + 1 },
        );

        // Promise should be cancelled
        const promise = await fixture.testHelper.getPromise('delegation_offer', txId);
        expect(promise!.status).toBe('cancelled');

        // Lender should have 0 SPSP_OUT (all unlocked)
        lenderOut = await fixture.testHelper.getDummyToken(lender, TOKENS.SPSP_OUT);
        expect(lenderOut?.balance ?? 0).toBe(0);

        // System account should have 0 SPSP_IN
        const sysIn = await fixture.testHelper.getDummyToken('$DELEGATION_PROMISES', TOKENS.SPSP_IN);
        expect(sysIn?.balance ?? 0).toBe(0);

        // History should show cancel
        const history = await fixture.testHelper.getPromiseHistory(promise!.id);
        const cancelHistory = history.find((h) => h.action === 'cancel');
        expect(cancelHistory).toBeDefined();
        expect(cancelHistory!.player).toBe(lender);
    });

    test.dbOnly('cancel partially filled promise returns only remaining SPSP to lender', async () => {
        const blockNum = getBlockAfterTransition();
        const txId = 'tx-cancel-partial';
        await fixture.testHelper.setStaked(lender, 1000);

        // Create offer for 100 SPSP
        await fixture.opsHelper.processOp(
            'create_promise',
            lender,
            {
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
        );

        // Fill 60 of 100
        await fixture.opsHelper.processOp(
            'fulfill_promise',
            controller,
            {
                id: txId,
                type: 'delegation_offer',
                metadata: {
                    borrower: borrower,
                    rental_id: 'rental-1',
                    qty: 60,
                    expiration_blocks: 100000,
                },
            },
            { block_num: blockNum + 1 },
        );

        // Verify state before cancel - system has 40 locked, borrower has 60
        let sysIn = await fixture.testHelper.getDummyToken('$DELEGATION_PROMISES', TOKENS.SPSP_IN);
        expect(sysIn?.balance).toBe(40);
        let borrowerIn = await fixture.testHelper.getDummyToken(borrower, TOKENS.SPSP_IN);
        expect(borrowerIn?.balance).toBe(60);

        // Cancel the promise (must be lender)
        await fixture.opsHelper.processOp(
            'cancel_promise',
            lender,
            {
                id: txId,
                type: 'delegation_offer',
            },
            { block_num: blockNum + 2 },
        );

        // Promise should be cancelled
        const promise = await fixture.testHelper.getPromise('delegation_offer', txId);
        expect(promise!.status).toBe('cancelled');

        // System account should have 0 SPSP_IN (remaining 40 was returned)
        sysIn = await fixture.testHelper.getDummyToken('$DELEGATION_PROMISES', TOKENS.SPSP_IN);
        expect(sysIn?.balance ?? 0).toBe(0);

        // Borrower still has 60 SPSP_IN (active rental not affected)
        borrowerIn = await fixture.testHelper.getDummyToken(borrower, TOKENS.SPSP_IN);
        expect(borrowerIn?.balance).toBe(60);

        // Lender should have 60 SPSP_OUT remaining (only the active rental to borrower)
        const lenderOut = await fixture.testHelper.getDummyToken(lender, TOKENS.SPSP_OUT);
        expect(lenderOut?.balance).toBe(60);

        // Active delegation record to $DELEGATION_PROMISES should be 0 or gone
        const sysDelegation = await fixture.testHelper.getActiveDelegationRecord(lender, '$DELEGATION_PROMISES', TOKENS.SPSP);
        expect(sysDelegation === null || parseFloat(sysDelegation.amount) === 0).toBe(true);

        // Active delegation record to borrower should be 60
        const borrowerDelegation = await fixture.testHelper.getActiveDelegationRecord(lender, borrower, TOKENS.SPSP);
        expect(borrowerDelegation).not.toBeNull();
        expect(parseFloat(borrowerDelegation!.amount)).toBe(60);

        // Rental delegation record should still be active
        const rental = await fixture.testHelper.getRentalDelegation('rental-1');
        expect(rental).not.toBeNull();
        expect(rental!.status).toBe('active');
    });

    test.dbOnly('cancel with multiple partial fills returns correct remaining amount', async () => {
        const blockNum = getBlockAfterTransition();
        const txId = 'tx-cancel-multi';
        const borrower2 = 'borrower2';
        await fixture.testHelper.setHiveAccount(borrower2);
        await fixture.testHelper.setStaked(lender, 1000);

        // Create offer for 200 SPSP
        await fixture.opsHelper.processOp(
            'create_promise',
            lender,
            {
                type: 'delegation_offer',
                controllers: [controller],
                params: {
                    token: TOKENS.SPSP,
                    qty: 200,
                    lender: lender,
                    price: 0.001,
                },
            },
            { block_num: blockNum, transaction: txId },
        );

        // Fill 50 to borrower
        await fixture.opsHelper.processOp(
            'fulfill_promise',
            controller,
            {
                id: txId,
                type: 'delegation_offer',
                metadata: {
                    borrower: borrower,
                    rental_id: 'rental-1',
                    qty: 50,
                    expiration_blocks: 100000,
                },
            },
            { block_num: blockNum + 1 },
        );

        // Fill 30 to borrower2
        await fixture.opsHelper.processOp(
            'fulfill_promise',
            controller,
            {
                id: txId,
                type: 'delegation_offer',
                metadata: {
                    borrower: borrower2,
                    rental_id: 'rental-2',
                    qty: 30,
                    expiration_blocks: 100000,
                },
            },
            { block_num: blockNum + 2 },
        );

        // 120 remaining in system account
        let sysIn = await fixture.testHelper.getDummyToken('$DELEGATION_PROMISES', TOKENS.SPSP_IN);
        expect(sysIn?.balance).toBe(120);

        // Cancel the promise (must be lender)
        await fixture.opsHelper.processOp(
            'cancel_promise',
            lender,
            {
                id: txId,
                type: 'delegation_offer',
            },
            { block_num: blockNum + 3 },
        );

        const promise = await fixture.testHelper.getPromise('delegation_offer', txId);
        expect(promise!.status).toBe('cancelled');

        // System account should have 0 SPSP_IN (120 remaining was returned)
        sysIn = await fixture.testHelper.getDummyToken('$DELEGATION_PROMISES', TOKENS.SPSP_IN);
        expect(sysIn?.balance ?? 0).toBe(0);

        // Lender should have 80 SPSP_OUT (50 to borrower + 30 to borrower2)
        const lenderOut = await fixture.testHelper.getDummyToken(lender, TOKENS.SPSP_OUT);
        expect(lenderOut?.balance).toBe(80);

        // Borrower still has 50 SPSP_IN
        const borrowerIn = await fixture.testHelper.getDummyToken(borrower, TOKENS.SPSP_IN);
        expect(borrowerIn?.balance).toBe(50);

        // Borrower2 still has 30 SPSP_IN
        const borrower2In = await fixture.testHelper.getDummyToken(borrower2, TOKENS.SPSP_IN);
        expect(borrower2In?.balance).toBe(30);
    });
});

// ─── REVERSE REJECTED ──────────────────────────────────────────────────────────

describe('delegation_offer reverse', () => {
    const getBlockAfterTransition = () => transitionPoints.transition_points.delegation_offer_block + 10;

    test.dbOnly('reversing a delegation_offer promise is not allowed', async () => {
        const blockNum = getBlockAfterTransition();
        await fixture.testHelper.setStaked(lender, 1000);

        // Insert a fulfilled delegation_offer promise
        await fixture.testHelper.insertPromise({
            type: 'delegation_offer',
            ext_id: 'offer-1',
            controllers: [controller],
            status: 'fulfilled',
            params: {
                token: TOKENS.SPSP,
                qty: 100,
                lender: lender,
                price: 0.001,
                qty_remaining: 0,
            },
            fulfill_timeout_seconds: null,
            fulfilled_at: new Date(),
            fulfilled_by: controller,
            fulfilled_expiration: null,
            created_date: new Date(),
            updated_date: new Date(),
        });

        await fixture.opsHelper.processOp(
            'reverse_promise',
            controller,
            {
                id: 'offer-1',
                type: 'delegation_offer',
            },
            { block_num: blockNum },
        );

        // Promise should still be fulfilled (reverse was rejected)
        const promise = await fixture.testHelper.getPromise('delegation_offer', 'offer-1');
        expect(promise!.status).toBe('fulfilled');
    });
});
