import { emoji_payload, garbage_payload } from '../../../__tests__/db-helpers';
import { Fixture } from '../../../__tests__/action-fixture';
import { container } from '../../../__tests__/test-composition-root';

const fixture = container.resolve(Fixture);

const lender = 'lender_account';
const borrower = 'borrower_account';
const token = 'SPSP';
const promiseType = 'delegation_offer';
const activeRentalId = 'active-rental-1';
const expiredRentalId = 'expired-rental-1';
const expiredRentalId2 = 'expired-rental-2';
const qty = '100.000';

beforeAll(async () => {
    await fixture.init();
});

beforeEach(async () => {
    await fixture.restore();
    await fixture.testHelper.setHiveAccount(lender);
    await fixture.testHelper.setHiveAccount(borrower);

    // Set up staked balance for lender
    await fixture.testHelper.setStaked(lender, 500);

    // Set up delegated out from lender and delegated in to borrower
    await fixture.testHelper.setDelegatedOut(lender, 300);
    await fixture.testHelper.setDelegatedIn(borrower, 300);

    await fixture.loader.load();
});

afterAll(async () => {
    await fixture.dispose();
});

test.dbOnly('Garbage data for expire_rental_delegations does not crash.', () => {
    return expect(fixture.opsHelper.processOp('expire_rental_delegations', lender, garbage_payload)).resolves.toBeUndefined();
});

test.dbOnly('Lots of emoji for expire_rental_delegations does not crash.', () => {
    return expect(fixture.opsHelper.processOp('expire_rental_delegations', lender, emoji_payload)).resolves.toBeUndefined();
});

test.dbOnly('expire_rental_delegations does nothing when no rentals exist.', async () => {
    await expect(
        fixture.opsHelper.processVirtualOp('expire_rental_delegations', lender, {
            block_num: 1000,
        }),
    ).resolves.toBeUndefined();
});

test.dbOnly('expire_rental_delegations does not affect active (non-expired) rentals.', async () => {
    // Insert an active rental that expires at block 2000
    await fixture.testHelper.insertRentalDelegation({
        id: activeRentalId,
        promise_type: promiseType,
        promise_ext_id: 'offer-1',
        lender,
        borrower,
        token,
        qty,
        expiration_block: 2000,
        start_block: 100,
        expiration_blocks: 1900,
        status: 'active',
    });

    // Process at block 1000 (before expiration)
    await expect(
        fixture.opsHelper.processVirtualOp('expire_rental_delegations', lender, {
            block_num: 1000,
        }),
    ).resolves.toBeUndefined();

    // Rental should still be active
    const rental = await fixture.testHelper.getRentalDelegation(activeRentalId);
    expect(rental).not.toBeNull();
    expect(rental!.status).toBe('active');
});

test.dbOnly('expire_rental_delegations expires rentals past their expiration block.', async () => {
    // Insert an active rental that expired at block 500
    await fixture.testHelper.insertRentalDelegation({
        id: expiredRentalId,
        promise_type: promiseType,
        promise_ext_id: 'offer-2',
        lender,
        borrower,
        token,
        qty,
        expiration_block: 500,
        start_block: 100,
        expiration_blocks: 400,
        status: 'active',
    });

    // Process at block 1000 (after expiration)
    await expect(
        fixture.opsHelper.processVirtualOp('expire_rental_delegations', lender, {
            block_num: 1000,
        }),
    ).resolves.toBeUndefined();

    // Rental should now be expired
    const rental = await fixture.testHelper.getRentalDelegation(expiredRentalId);
    expect(rental).not.toBeNull();
    expect(rental!.status).toBe('expired');
});

test.dbOnly('expire_rental_delegations handles multiple expired rentals.', async () => {
    // Insert first expired rental
    await fixture.testHelper.insertRentalDelegation({
        id: expiredRentalId,
        promise_type: promiseType,
        promise_ext_id: 'offer-3',
        lender,
        borrower,
        token,
        qty: '100.000',
        expiration_block: 500,
        start_block: 100,
        expiration_blocks: 400,
        status: 'active',
    });

    // Insert second expired rental
    await fixture.testHelper.insertRentalDelegation({
        id: expiredRentalId2,
        promise_type: promiseType,
        promise_ext_id: 'offer-4',
        lender,
        borrower,
        token,
        qty: '50.000',
        expiration_block: 600,
        start_block: 200,
        expiration_blocks: 400,
        status: 'active',
    });

    // Insert an active rental that should NOT be expired
    await fixture.testHelper.insertRentalDelegation({
        id: activeRentalId,
        promise_type: promiseType,
        promise_ext_id: 'offer-5',
        lender,
        borrower,
        token,
        qty: '25.000',
        expiration_block: 2000,
        start_block: 100,
        expiration_blocks: 1900,
        status: 'active',
    });

    // Process at block 1000 (after first two expired, before third)
    await expect(
        fixture.opsHelper.processVirtualOp('expire_rental_delegations', lender, {
            block_num: 1000,
        }),
    ).resolves.toBeUndefined();

    // First two rentals should be expired
    const rental1 = await fixture.testHelper.getRentalDelegation(expiredRentalId);
    expect(rental1).not.toBeNull();
    expect(rental1!.status).toBe('expired');

    const rental2 = await fixture.testHelper.getRentalDelegation(expiredRentalId2);
    expect(rental2).not.toBeNull();
    expect(rental2!.status).toBe('expired');

    // Active rental should still be active
    const activeRental = await fixture.testHelper.getRentalDelegation(activeRentalId);
    expect(activeRental).not.toBeNull();
    expect(activeRental!.status).toBe('active');
});

test.dbOnly('expire_rental_delegations does not affect already expired rentals.', async () => {
    // Insert an already expired rental
    await fixture.testHelper.insertRentalDelegation({
        id: expiredRentalId,
        promise_type: promiseType,
        promise_ext_id: 'offer-6',
        lender,
        borrower,
        token,
        qty,
        expiration_block: 500,
        start_block: 100,
        expiration_blocks: 400,
        status: 'expired', // Already expired
    });

    // Process should succeed without error
    await expect(
        fixture.opsHelper.processVirtualOp('expire_rental_delegations', lender, {
            block_num: 1000,
        }),
    ).resolves.toBeUndefined();

    // Rental should still be expired (unchanged)
    const rental = await fixture.testHelper.getRentalDelegation(expiredRentalId);
    expect(rental).not.toBeNull();
    expect(rental!.status).toBe('expired');
});

test.dbOnly('expire_rental_delegations does not affect cancelled rentals.', async () => {
    // Insert a cancelled rental with expired block
    await fixture.testHelper.insertRentalDelegation({
        id: expiredRentalId,
        promise_type: promiseType,
        promise_ext_id: 'offer-7',
        lender,
        borrower,
        token,
        qty,
        expiration_block: 500,
        start_block: 100,
        expiration_blocks: 400,
        status: 'cancelled',
    });

    // Process should succeed without error
    await expect(
        fixture.opsHelper.processVirtualOp('expire_rental_delegations', lender, {
            block_num: 1000,
        }),
    ).resolves.toBeUndefined();

    // Rental should still be cancelled (unchanged)
    const rental = await fixture.testHelper.getRentalDelegation(expiredRentalId);
    expect(rental).not.toBeNull();
    expect(rental!.status).toBe('cancelled');
});
