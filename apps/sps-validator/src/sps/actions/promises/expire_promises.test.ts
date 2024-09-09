import { emoji_payload, garbage_payload } from '../../../__tests__/db-helpers';
import { Fixture } from '../../../__tests__/action-fixture';
import { container } from '../../../__tests__/test-composition-root';
import { TOKENS } from '../../features/tokens';

const fixture = container.resolve(Fixture);

const promise_creator = 'AdminAccount';
const delegation_to = 'stephen';
const delegator = 'kya';
const fulfilled_promise_id = '1';
const open_promise_id = '2';
const fulfilled_unexpired_promise_id = '3';
const expiration = new Date();

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

    // fulfilled promise (not expired)
    const unexpired = new Date(expiration);
    unexpired.setHours(unexpired.getHours() + 1);
    await fixture.testHelper.insertPromise({
        type: 'delegation',
        ext_id: fulfilled_unexpired_promise_id,
        controllers: [promise_creator],
        status: 'fulfilled',
        params: {
            qty: 100,
            token: 'SPSP',
            to: delegation_to,
        },
        fulfill_timeout_seconds: 120 * 60,
        fulfilled_at: new Date(),
        fulfilled_by: delegator,
        fulfilled_expiration: unexpired,
        created_date: new Date(),
        updated_date: new Date(),
    });

    // fulfilled promise (expired)
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
        fulfill_timeout_seconds: 60 * 60,
        fulfilled_at: new Date(),
        fulfilled_by: delegator,
        fulfilled_expiration: expiration,
        created_date: new Date(),
        updated_date: new Date(),
    });
    // TODO do we need to set the $DELEGATION balances correctly for this test
    await fixture.testHelper.setDelegatedIn('$DELEGATION_PROMISES', 200);
    await fixture.testHelper.setDelegatedOut(delegator, 200);
    await fixture.testHelper.setStaked(delegator, 200);

    await fixture.loader.load();
});

afterAll(async () => {
    await fixture.dispose();
});

test.dbOnly('Garbage data for expire_promises does not crash.', () => {
    return expect(fixture.opsHelper.processOp('expire_promises', promise_creator, garbage_payload)).resolves.toBeUndefined();
});

test.dbOnly('Lots of emoji for expire_promises does not crash.', () => {
    return expect(fixture.opsHelper.processOp('expire_promises', promise_creator, emoji_payload)).resolves.toBeUndefined();
});

test.dbOnly('expire_promises succeeds.', async () => {
    const now = new Date(expiration);
    now.setMinutes(now.getMinutes() + 1);
    await expect(
        fixture.opsHelper.processVirtualOp('expire_promises', promise_creator, {
            now,
        }),
    ).resolves.toBeUndefined();

    const result = await fixture.testHelper.getPromise('delegation', fulfilled_promise_id);
    expect(result!.status).toBe('open');
    const [history] = await fixture.testHelper.getPromiseHistory(result!.id);
    expect(history).toMatchObject({
        action: 'reverse',
        previous_status: 'fulfilled',
        new_status: 'open',
        player: promise_creator,
    });

    const result2 = await fixture.testHelper.getPromise('delegation', fulfilled_unexpired_promise_id);
    expect(result2!.status).toBe('fulfilled');
    const history2 = await fixture.testHelper.getPromiseHistory(result2!.id);
    expect(history2).toHaveLength(0);

    const result3 = await fixture.testHelper.getPromise('delegation', open_promise_id);
    expect(result3!.status).toBe('open');
    const history3 = await fixture.testHelper.getPromiseHistory(result3!.id);
    expect(history3).toHaveLength(0);

    const spsIn = await fixture.testHelper.getDummyToken('$DELEGATION_PROMISES', TOKENS.SPSP_IN);
    expect(spsIn?.balance).toBe(100);
    const spsOut = await fixture.testHelper.getDummyToken(delegator, TOKENS.SPSP_OUT);
    expect(spsOut?.balance).toBe(100);
});
