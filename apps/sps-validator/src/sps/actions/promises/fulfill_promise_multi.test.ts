import { emoji_payload, garbage_payload } from '../../../__tests__/db-helpers';
import { Fixture } from '../../../__tests__/action-fixture';
import { container } from '../../../__tests__/test-composition-root';
import { TOKENS } from '../../features/tokens';

const fixture = container.resolve(Fixture);

const promise_creator = 'AdminAccount';
const delegation_to = 'stephen';
const delegator = 'kya';
const open_promise_id = '1';
const cancelled_promise_id = '2';
const fulfilled_promise_id = '3';
const open_promise_id2 = '4';
const open_promise_id3 = '5';

beforeAll(async () => {
    await fixture.init();
});

beforeEach(async () => {
    await fixture.restore();
    await fixture.testHelper.setHiveAccount(promise_creator);
    await fixture.testHelper.setHiveAccount(delegation_to);
    await fixture.testHelper.setHiveAccount(delegator);
    await fixture.testHelper.insertExistingAdmins([promise_creator]);

    // open promise
    await fixture.testHelper.insertPromise({
        type: 'delegation',
        ext_id: open_promise_id,
        controllers: [promise_creator],
        status: 'open',
        params: {
            qty: 100,
            token: 'SPSP',
            to: delegation_to,
        },
        fulfill_timeout_seconds: 60_000,
        fulfilled_at: null,
        fulfilled_by: null,
        fulfilled_expiration: null,
        created_date: new Date(),
        updated_date: new Date(),
    });

    await fixture.testHelper.insertPromise({
        type: 'delegation',
        ext_id: open_promise_id2,
        controllers: [promise_creator],
        status: 'open',
        params: {
            qty: 100,
            token: 'SPSP',
            to: delegation_to,
        },
        fulfill_timeout_seconds: 60_000,
        fulfilled_at: null,
        fulfilled_by: null,
        fulfilled_expiration: null,
        created_date: new Date(),
        updated_date: new Date(),
    });

    await fixture.testHelper.insertPromise({
        type: 'delegation',
        ext_id: open_promise_id3,
        controllers: [promise_creator],
        status: 'open',
        params: {
            qty: 100,
            token: 'SPSP',
            to: delegation_to,
        },
        fulfill_timeout_seconds: 60_000,
        fulfilled_at: null,
        fulfilled_by: null,
        fulfilled_expiration: null,
        created_date: new Date(),
        updated_date: new Date(),
    });

    // cancelled promise
    await fixture.testHelper.insertPromise({
        type: 'delegation',
        ext_id: cancelled_promise_id,
        controllers: [promise_creator],
        status: 'cancelled',
        params: {
            qty: 100,
            token: 'SPS',
            to: delegation_to,
        },
        fulfill_timeout_seconds: 60_000,
        fulfilled_at: null,
        fulfilled_by: null,
        fulfilled_expiration: null,
        created_date: new Date(),
        updated_date: new Date(),
    });

    // fulfilled promise
    const expiration = new Date();
    expiration.setHours(expiration.getHours() + 1);
    await fixture.testHelper.insertPromise({
        type: 'delegation',
        ext_id: fulfilled_promise_id,
        controllers: [promise_creator],
        status: 'fulfilled',
        params: {
            qty: 100,
            token: 'SPSP',
            to: delegation_to,
        },
        fulfill_timeout_seconds: 60_000,
        fulfilled_at: new Date(),
        fulfilled_by: delegator,
        fulfilled_expiration: null,
        created_date: new Date(),
        updated_date: new Date(),
    }); //$DELEGATION

    // TODO do we need to set the $DELEGATION balances correctly for this test
    await fixture.testHelper.setDelegatedIn('$DELEGATION_PROMISES', 100);
    await fixture.testHelper.setDelegatedOut(delegator, 100);
    await fixture.testHelper.setDelegatedIn(delegation_to, 0);
    await fixture.testHelper.setStaked(delegator, 300);

    await fixture.loader.load();
});

afterAll(async () => {
    await fixture.dispose();
});

test.dbOnly('Garbage data for fulfill_promise_multi does not crash.', () => {
    return expect(fixture.opsHelper.processOp('fulfill_promise_multi', promise_creator, garbage_payload)).resolves.toBeUndefined();
});

test.dbOnly('Lots of emoji for fulfill_promise_multi does not crash.', () => {
    return expect(fixture.opsHelper.processOp('fulfill_promise_multi', promise_creator, emoji_payload)).resolves.toBeUndefined();
});

test.dbOnly('fulfill_promise_multi with invalid payload fails.', async () => {
    await expect(
        fixture.opsHelper.processOp('fulfill_promise_multi', promise_creator, {
            type: 'delegation',
            // missing controllers / fulfill_timeout_seconds
        }),
    ).resolves.toBeUndefined();

    const result = await fixture.testHelper.getPromise('delegation', open_promise_id);
    expect(result?.status).toBe('open');
});

test.dbOnly('fulfill_promise_multi with invalid type fails.', async () => {
    await expect(
        fixture.opsHelper.processOp('fulfill_promise_multi', promise_creator, {
            ids: [open_promise_id, open_promise_id2],
            type: 'invalid_type',
        }),
    ).resolves.toBeUndefined();

    const result = await fixture.testHelper.getPromise('delegation', open_promise_id);
    expect(result?.status).toBe('open');
    const result2 = await fixture.testHelper.getPromise('delegation', open_promise_id2);
    expect(result2?.status).toBe('open');
});

// DELEGATION PROMISES

test.dbOnly('fulfill_promise_multi with promise "holder" account fails.', async () => {
    await expect(
        fixture.opsHelper.processOp('fulfill_promise_multi', delegation_to, {
            ids: [open_promise_id, open_promise_id2],
            type: 'delegation',
        }),
    ).resolves.toBeUndefined();

    const result = await fixture.testHelper.getPromise('delegation', open_promise_id);
    expect(result?.status).toBe('open');
    const result2 = await fixture.testHelper.getPromise('delegation', open_promise_id2);
    expect(result2?.status).toBe('open');
});

test.dbOnly('fulfill_promise_multi with not enough tokens fails.', async () => {
    await expect(
        fixture.opsHelper.processOp('fulfill_promise_multi', delegation_to, {
            ids: [open_promise_id, open_promise_id2, open_promise_id3],
            type: 'delegation',
        }),
    ).resolves.toBeUndefined();

    const result = await fixture.testHelper.getPromise('delegation', open_promise_id);
    expect(result?.status).toBe('open');
    const result2 = await fixture.testHelper.getPromise('delegation', open_promise_id2);
    expect(result2?.status).toBe('open');
    const result3 = await fixture.testHelper.getPromise('delegation', open_promise_id3);
    expect(result3?.status).toBe('open');
});

test.dbOnly('fulfill_promise_multi on open promises succeeds.', async () => {
    await expect(
        fixture.opsHelper.processOp('fulfill_promise_multi', delegator, {
            ids: [open_promise_id, open_promise_id2],
            type: 'delegation',
        }),
    ).resolves.toBeUndefined();

    const result = await fixture.testHelper.getPromise('delegation', open_promise_id);
    expect(result?.status).toBe('fulfilled');
    const result2 = await fixture.testHelper.getPromise('delegation', open_promise_id2);
    expect(result2?.status).toBe('fulfilled');

    const [history] = await fixture.testHelper.getPromiseHistory(result!.id);
    expect(history).toMatchObject({
        action: 'fulfill',
        previous_status: 'open',
        new_status: 'fulfilled',
        player: delegator,
    });

    const [history2] = await fixture.testHelper.getPromiseHistory(result2!.id);
    expect(history2).toMatchObject({
        action: 'fulfill',
        previous_status: 'open',
        new_status: 'fulfilled',
        player: delegator,
    });

    const spsIn = await fixture.testHelper.getDummyToken('$DELEGATION_PROMISES', TOKENS.SPSP_IN);
    expect(spsIn?.balance).toBe(300);
    const spsOut = await fixture.testHelper.getDummyToken(delegator, TOKENS.SPSP_OUT);
    expect(spsOut?.balance).toBe(300);
    // should not have the tokens yet
    const delegationToSpsIn = await fixture.testHelper.getDummyToken(delegation_to, TOKENS.SPSP_IN);
    expect(delegationToSpsIn?.balance).toBe(0);
});

test.dbOnly('fulfill_promise_multi with cancelled promise fails.', async () => {
    await expect(
        fixture.opsHelper.processOp('fulfill_promise_multi', delegator, {
            ids: [open_promise_id, open_promise_id2, cancelled_promise_id],
            type: 'delegation',
        }),
    ).resolves.toBeUndefined();

    const result = await fixture.testHelper.getPromise('delegation', cancelled_promise_id);
    expect(result?.status).toBe('cancelled');

    const history = await fixture.testHelper.getPromiseHistory(result!.id);
    expect(history).toHaveLength(0);

    const openResult = await fixture.testHelper.getPromise('delegation', open_promise_id);
    expect(openResult?.status).toBe('open');
    const openResult2 = await fixture.testHelper.getPromise('delegation', open_promise_id2);
    expect(openResult2?.status).toBe('open');

    const openHistory = await fixture.testHelper.getPromiseHistory(openResult!.id);
    expect(openHistory).toHaveLength(0);

    const openHistory2 = await fixture.testHelper.getPromiseHistory(openResult2!.id);
    expect(openHistory2).toHaveLength(0);

    // these balances represent the fulfilled promise. confirm they havent been touched
    const spsIn = await fixture.testHelper.getDummyToken('$DELEGATION_PROMISES', TOKENS.SPSP_IN);
    expect(spsIn?.balance).toBe(100);
    const spsOut = await fixture.testHelper.getDummyToken(delegator, TOKENS.SPSP_OUT);
    expect(spsOut?.balance).toBe(100);
});

test.dbOnly('fulfill_promise_multi with fulfilled promise fails.', async () => {
    await expect(
        fixture.opsHelper.processOp('fulfill_promise_multi', delegator, {
            ids: [open_promise_id, open_promise_id2, fulfilled_promise_id],
            type: 'delegation',
        }),
    ).resolves.toBeUndefined();

    const result = await fixture.testHelper.getPromise('delegation', fulfilled_promise_id);
    expect(result?.status).toBe('fulfilled');

    const history = await fixture.testHelper.getPromiseHistory(result!.id);
    expect(history).toHaveLength(0);

    const openResult = await fixture.testHelper.getPromise('delegation', open_promise_id);
    expect(openResult?.status).toBe('open');
    const openResult2 = await fixture.testHelper.getPromise('delegation', open_promise_id2);
    expect(openResult2?.status).toBe('open');

    const openHistory = await fixture.testHelper.getPromiseHistory(openResult!.id);
    expect(openHistory).toHaveLength(0);

    const openHistory2 = await fixture.testHelper.getPromiseHistory(openResult2!.id);
    expect(openHistory2).toHaveLength(0);

    // these balances represent the fulfilled promise. confirm they havent been touched
    const spsIn = await fixture.testHelper.getDummyToken('$DELEGATION_PROMISES', TOKENS.SPSP_IN);
    expect(spsIn?.balance).toBe(100);
    const spsOut = await fixture.testHelper.getDummyToken(delegator, TOKENS.SPSP_OUT);
    expect(spsOut?.balance).toBe(100);
});
