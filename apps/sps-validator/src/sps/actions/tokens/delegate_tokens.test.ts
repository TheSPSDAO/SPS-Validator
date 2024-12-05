import { emoji_payload, garbage_payload } from '../../../__tests__/db-helpers';
import { container } from '../../../__tests__/test-composition-root';
import { Fixture } from '../../../__tests__/action-fixture';
import { TOKENS } from '../../features/tokens';

const fixture = container.resolve(Fixture);
const DELEGATION_ACCOUNT = '$DELEGATION';
const initial_staked_amount = 100;
const delegatorWithAuthority = 'steemmonstersauth';
const delegatorWithoutAuthority = 'steemmonstersauth2';
const delegator = 'steemmonsters';
const delegatee = 'steemmonsters2';
const system_delegatee = '$SOULKEEP';

beforeAll(async () => {
    await fixture.init();
});

beforeEach(async () => {
    await fixture.restore();

    await fixture.testHelper.setHiveAccount(delegatorWithAuthority);
    await fixture.testHelper.setHiveAccount(delegatorWithoutAuthority);
    await fixture.testHelper.setHiveAccount(delegator, { delegation: [delegatorWithAuthority] });
    await fixture.testHelper.setHiveAccount(delegatee);
    await fixture.testHelper.setStaked(delegator, initial_staked_amount);
    await fixture.testHelper.setDelegatedOut(delegator, 0);
    await fixture.testHelper.setDelegatedIn(delegator, 0);
    await fixture.testHelper.setStaked(delegatee, 0);
    await fixture.testHelper.setDelegatedOut(delegatee, 0);
    await fixture.testHelper.setDelegatedIn(delegatee, 0);
    await fixture.testHelper.setStaked(system_delegatee, 0);
    await fixture.testHelper.setDelegatedOut(system_delegatee, 0);
    await fixture.testHelper.setDelegatedIn(system_delegatee, 0);
    await fixture.testHelper.setDelegatedOut(DELEGATION_ACCOUNT, 0);
    await fixture.testHelper.setDelegatedIn(DELEGATION_ACCOUNT, 0);

    await fixture.loader.load();
});

afterAll(async () => {
    await fixture.dispose();
});

test.dbOnly('Garbage data for delegate_tokens does not crash.', () => {
    return expect(fixture.opsHelper.processOp('delegate_tokens', 'steemmonsters', garbage_payload)).resolves.toBeUndefined();
});

test.dbOnly('Lots of emoji for delegate_tokens does not crash.', () => {
    return expect(fixture.opsHelper.processOp('delegate_tokens', 'steemmonsters', emoji_payload)).resolves.toBeUndefined();
});

test.dbOnly('Simple delegate tokens.', async () => {
    const amount_to_delegate = 50;

    await expect(
        fixture.opsHelper.processOp('delegate_tokens', delegator, {
            token: 'SPSP',
            to: delegatee,
            qty: amount_to_delegate,
        }),
    ).resolves.toBeUndefined();

    const active_delegation_record = (await fixture.testHelper.getActiveDelegationRecord(delegator, delegatee, TOKENS.SPSP))!;

    const delegator_SPSP_balance_after = (await fixture.testHelper.getDummyToken(delegator, TOKENS.SPSP))!.balance;
    const delegator_SPSP_OUT_balance_after = (await fixture.testHelper.getDummyToken(delegator, TOKENS.SPSP_OUT))!.balance;
    const delegator_SPSP_IN_balance_after = (await fixture.testHelper.getDummyToken(delegator, TOKENS.SPSP_IN))!.balance;

    const delegatee_SPSP_balance_after = (await fixture.testHelper.getDummyToken(delegatee, TOKENS.SPSP))!.balance;
    const delegatee_SPSP_OUT_balance_after = (await fixture.testHelper.getDummyToken(delegatee, TOKENS.SPSP_OUT))!.balance;
    const delegatee_SPSP_IN_balance_after = (await fixture.testHelper.getDummyToken(delegatee, TOKENS.SPSP_IN))!.balance;

    const sysacc_SPSP_OUT_balance_after = (await fixture.testHelper.getDummyToken(DELEGATION_ACCOUNT, TOKENS.SPSP_OUT))!.balance;
    const sysacc_SPSP_IN_balance_after = (await fixture.testHelper.getDummyToken(DELEGATION_ACCOUNT, TOKENS.SPSP_IN))!.balance;

    expect(active_delegation_record.amount).toBe(amount_to_delegate.toString());
    expect(delegator_SPSP_balance_after).toBe(initial_staked_amount);
    expect(delegator_SPSP_OUT_balance_after).toBe(amount_to_delegate);
    expect(delegator_SPSP_IN_balance_after).toBe(0);

    expect(delegatee_SPSP_balance_after).toBe(0);
    expect(delegatee_SPSP_OUT_balance_after).toBe(0);
    expect(delegatee_SPSP_IN_balance_after).toBe(amount_to_delegate);

    expect(sysacc_SPSP_OUT_balance_after).toBe(-amount_to_delegate);
    expect(sysacc_SPSP_IN_balance_after).toBe(-amount_to_delegate);
});

test.dbOnly('Simple delegate tokens to whitelisted system account.', async () => {
    const amount_to_delegate = 50;

    await expect(
        fixture.opsHelper.processOp('delegate_tokens', delegator, {
            token: 'SPSP',
            to: system_delegatee,
            qty: amount_to_delegate,
        }),
    ).resolves.toBeUndefined();

    const active_delegation_record = (await fixture.testHelper.getActiveDelegationRecord(delegator, system_delegatee, TOKENS.SPSP))!;

    const delegator_SPSP_balance_after = (await fixture.testHelper.getDummyToken(delegator, TOKENS.SPSP))!.balance;
    const delegator_SPSP_OUT_balance_after = (await fixture.testHelper.getDummyToken(delegator, TOKENS.SPSP_OUT))!.balance;
    const delegator_SPSP_IN_balance_after = (await fixture.testHelper.getDummyToken(delegator, TOKENS.SPSP_IN))!.balance;

    const delegatee_SPSP_balance_after = (await fixture.testHelper.getDummyToken(system_delegatee, TOKENS.SPSP))!.balance;
    const delegatee_SPSP_OUT_balance_after = (await fixture.testHelper.getDummyToken(system_delegatee, TOKENS.SPSP_OUT))!.balance;
    const delegatee_SPSP_IN_balance_after = (await fixture.testHelper.getDummyToken(system_delegatee, TOKENS.SPSP_IN))!.balance;

    const sysacc_SPSP_OUT_balance_after = (await fixture.testHelper.getDummyToken(DELEGATION_ACCOUNT, TOKENS.SPSP_OUT))!.balance;
    const sysacc_SPSP_IN_balance_after = (await fixture.testHelper.getDummyToken(DELEGATION_ACCOUNT, TOKENS.SPSP_IN))!.balance;

    expect(active_delegation_record.amount).toBe(amount_to_delegate.toString());
    expect(delegator_SPSP_balance_after).toBe(initial_staked_amount);
    expect(delegator_SPSP_OUT_balance_after).toBe(amount_to_delegate);
    expect(delegator_SPSP_IN_balance_after).toBe(0);

    expect(delegatee_SPSP_balance_after).toBe(0);
    expect(delegatee_SPSP_OUT_balance_after).toBe(0);
    expect(delegatee_SPSP_IN_balance_after).toBe(amount_to_delegate);

    expect(sysacc_SPSP_OUT_balance_after).toBe(-amount_to_delegate);
    expect(sysacc_SPSP_IN_balance_after).toBe(-amount_to_delegate);
});

test.dbOnly('Simple delegate tokens with authority.', async () => {
    const amount_to_delegate = 50;

    await expect(
        fixture.opsHelper.processOp('delegate_tokens', delegatorWithAuthority, {
            token: 'SPSP',
            to: delegatee,
            qty: amount_to_delegate,
            player: delegator,
        }),
    ).resolves.toBeUndefined();

    const active_delegation_record = (await fixture.testHelper.getActiveDelegationRecord(delegator, delegatee, TOKENS.SPSP))!;

    const delegator_SPSP_balance_after = (await fixture.testHelper.getDummyToken(delegator, TOKENS.SPSP))!.balance;
    const delegator_SPSP_OUT_balance_after = (await fixture.testHelper.getDummyToken(delegator, TOKENS.SPSP_OUT))!.balance;
    const delegator_SPSP_IN_balance_after = (await fixture.testHelper.getDummyToken(delegator, TOKENS.SPSP_IN))!.balance;

    const delegatee_SPSP_balance_after = (await fixture.testHelper.getDummyToken(delegatee, TOKENS.SPSP))!.balance;
    const delegatee_SPSP_OUT_balance_after = (await fixture.testHelper.getDummyToken(delegatee, TOKENS.SPSP_OUT))!.balance;
    const delegatee_SPSP_IN_balance_after = (await fixture.testHelper.getDummyToken(delegatee, TOKENS.SPSP_IN))!.balance;

    const sysacc_SPSP_OUT_balance_after = (await fixture.testHelper.getDummyToken(DELEGATION_ACCOUNT, TOKENS.SPSP_OUT))!.balance;
    const sysacc_SPSP_IN_balance_after = (await fixture.testHelper.getDummyToken(DELEGATION_ACCOUNT, TOKENS.SPSP_IN))!.balance;

    expect(active_delegation_record.amount).toBe(amount_to_delegate.toString());
    expect(delegator_SPSP_balance_after).toBe(initial_staked_amount);
    expect(delegator_SPSP_OUT_balance_after).toBe(amount_to_delegate);
    expect(delegator_SPSP_IN_balance_after).toBe(0);

    expect(delegatee_SPSP_balance_after).toBe(0);
    expect(delegatee_SPSP_OUT_balance_after).toBe(0);
    expect(delegatee_SPSP_IN_balance_after).toBe(amount_to_delegate);

    expect(sysacc_SPSP_OUT_balance_after).toBe(-amount_to_delegate);
    expect(sysacc_SPSP_IN_balance_after).toBe(-amount_to_delegate);
});

test.dbOnly('delegate without authority fails.', async () => {
    const amount_to_delegate = 50;

    await expect(
        fixture.opsHelper.processOp('delegate_tokens', delegatorWithoutAuthority, {
            token: 'SPSP',
            to: delegatee,
            qty: amount_to_delegate,
            player: delegator,
        }),
    ).resolves.toBeUndefined();

    const active_delegation_record = (await fixture.testHelper.getActiveDelegationRecord(delegator, delegatee, TOKENS.SPSP))!;

    const delegator_SPSP_balance_after = (await fixture.testHelper.getDummyToken(delegator, TOKENS.SPSP))!.balance;
    const delegator_SPSP_OUT_balance_after = (await fixture.testHelper.getDummyToken(delegator, TOKENS.SPSP_OUT))!.balance;
    const delegator_SPSP_IN_balance_after = (await fixture.testHelper.getDummyToken(delegator, TOKENS.SPSP_IN))!.balance;

    const delegatee_SPSP_balance_after = (await fixture.testHelper.getDummyToken(delegatee, TOKENS.SPSP))!.balance;
    const delegatee_SPSP_OUT_balance_after = (await fixture.testHelper.getDummyToken(delegatee, TOKENS.SPSP_OUT))!.balance;
    const delegatee_SPSP_IN_balance_after = (await fixture.testHelper.getDummyToken(delegatee, TOKENS.SPSP_IN))!.balance;

    const sysacc_SPSP_OUT_balance_after = (await fixture.testHelper.getDummyToken(DELEGATION_ACCOUNT, TOKENS.SPSP_OUT))!.balance;
    const sysacc_SPSP_IN_balance_after = (await fixture.testHelper.getDummyToken(DELEGATION_ACCOUNT, TOKENS.SPSP_IN))!.balance;

    expect(active_delegation_record).toBeNull();

    expect(delegator_SPSP_balance_after).toBe(initial_staked_amount);
    expect(delegator_SPSP_OUT_balance_after).toBe(0);
    expect(delegator_SPSP_IN_balance_after).toBe(0);

    expect(delegatee_SPSP_balance_after).toBe(0);
    expect(delegatee_SPSP_OUT_balance_after).toBe(0);
    expect(delegatee_SPSP_IN_balance_after).toBe(0);

    expect(sysacc_SPSP_OUT_balance_after).toBe(0);
    expect(sysacc_SPSP_IN_balance_after).toBe(0);
});

test.dbOnly('delegate to non-whitelisted system account fails.', async () => {
    const amount_to_delegate = 50;

    await expect(
        fixture.opsHelper.processOp('delegate_tokens', delegator, {
            token: 'SPSP',
            to: '$NOTSOULKEEP',
            qty: amount_to_delegate,
        }),
    ).resolves.toBeUndefined();

    const active_delegation_record = (await fixture.testHelper.getActiveDelegationRecord(delegator, delegatee, TOKENS.SPSP))!;

    const delegator_SPSP_balance_after = (await fixture.testHelper.getDummyToken(delegator, TOKENS.SPSP))!.balance;
    const delegator_SPSP_OUT_balance_after = (await fixture.testHelper.getDummyToken(delegator, TOKENS.SPSP_OUT))!.balance;
    const delegator_SPSP_IN_balance_after = (await fixture.testHelper.getDummyToken(delegator, TOKENS.SPSP_IN))!.balance;

    const sysacc_SPSP_OUT_balance_after = (await fixture.testHelper.getDummyToken(DELEGATION_ACCOUNT, TOKENS.SPSP_OUT))!.balance;
    const sysacc_SPSP_IN_balance_after = (await fixture.testHelper.getDummyToken(DELEGATION_ACCOUNT, TOKENS.SPSP_IN))!.balance;

    expect(active_delegation_record).toBeNull();

    expect(delegator_SPSP_balance_after).toBe(initial_staked_amount);
    expect(delegator_SPSP_OUT_balance_after).toBe(0);
    expect(delegator_SPSP_IN_balance_after).toBe(0);

    expect(sysacc_SPSP_OUT_balance_after).toBe(0);
    expect(sysacc_SPSP_IN_balance_after).toBe(0);
});

test.dbOnly('delegate more than staked balance fails.', async () => {
    const amount_to_delegate = 150;

    await expect(
        fixture.opsHelper.processOp('delegate_tokens', delegator, {
            token: 'SPSP',
            to: delegatee,
            qty: amount_to_delegate,
        }),
    ).resolves.toBeUndefined();

    const active_delegation_record = (await fixture.testHelper.getActiveDelegationRecord(delegator, delegatee, TOKENS.SPSP))!;

    const delegator_SPSP_balance_after = (await fixture.testHelper.getDummyToken(delegator, TOKENS.SPSP))!.balance;
    const delegator_SPSP_OUT_balance_after = (await fixture.testHelper.getDummyToken(delegator, TOKENS.SPSP_OUT))!.balance;
    const delegator_SPSP_IN_balance_after = (await fixture.testHelper.getDummyToken(delegator, TOKENS.SPSP_IN))!.balance;

    const delegatee_SPSP_balance_after = (await fixture.testHelper.getDummyToken(delegatee, TOKENS.SPSP))!.balance;
    const delegatee_SPSP_OUT_balance_after = (await fixture.testHelper.getDummyToken(delegatee, TOKENS.SPSP_OUT))!.balance;
    const delegatee_SPSP_IN_balance_after = (await fixture.testHelper.getDummyToken(delegatee, TOKENS.SPSP_IN))!.balance;

    const sysacc_SPSP_OUT_balance_after = (await fixture.testHelper.getDummyToken(DELEGATION_ACCOUNT, TOKENS.SPSP_OUT))!.balance;
    const sysacc_SPSP_IN_balance_after = (await fixture.testHelper.getDummyToken(DELEGATION_ACCOUNT, TOKENS.SPSP_IN))!.balance;

    expect(active_delegation_record).toBeNull();

    expect(delegator_SPSP_balance_after).toBe(initial_staked_amount);
    expect(delegator_SPSP_OUT_balance_after).toBe(0);
    expect(delegator_SPSP_IN_balance_after).toBe(0);

    expect(delegatee_SPSP_balance_after).toBe(0);
    expect(delegatee_SPSP_OUT_balance_after).toBe(0);
    expect(delegatee_SPSP_IN_balance_after).toBe(0);

    expect(sysacc_SPSP_OUT_balance_after).toBe(0);
    expect(sysacc_SPSP_IN_balance_after).toBe(0);
});

test.dbOnly('delegate negative amount fails.', async () => {
    const amount_to_delegate = -100;

    await expect(
        fixture.opsHelper.processOp('delegate_tokens', delegator, {
            token: 'SPSP',
            to: delegatee,
            qty: amount_to_delegate,
        }),
    ).resolves.toBeUndefined();

    const active_delegation_record = (await fixture.testHelper.getActiveDelegationRecord(delegator, delegatee, TOKENS.SPSP))!;

    const delegator_SPSP_balance_after = (await fixture.testHelper.getDummyToken(delegator, TOKENS.SPSP))!.balance;
    const delegator_SPSP_OUT_balance_after = (await fixture.testHelper.getDummyToken(delegator, TOKENS.SPSP_OUT))!.balance;
    const delegator_SPSP_IN_balance_after = (await fixture.testHelper.getDummyToken(delegator, TOKENS.SPSP_IN))!.balance;

    const delegatee_SPSP_balance_after = (await fixture.testHelper.getDummyToken(delegatee, TOKENS.SPSP))!.balance;
    const delegatee_SPSP_OUT_balance_after = (await fixture.testHelper.getDummyToken(delegatee, TOKENS.SPSP_OUT))!.balance;
    const delegatee_SPSP_IN_balance_after = (await fixture.testHelper.getDummyToken(delegatee, TOKENS.SPSP_IN))!.balance;

    const sysacc_SPSP_OUT_balance_after = (await fixture.testHelper.getDummyToken(DELEGATION_ACCOUNT, TOKENS.SPSP_OUT))!.balance;
    const sysacc_SPSP_IN_balance_after = (await fixture.testHelper.getDummyToken(DELEGATION_ACCOUNT, TOKENS.SPSP_IN))!.balance;

    expect(active_delegation_record).toBeNull();

    expect(delegator_SPSP_balance_after).toBe(initial_staked_amount);
    expect(delegator_SPSP_OUT_balance_after).toBe(0);
    expect(delegator_SPSP_IN_balance_after).toBe(0);

    expect(delegatee_SPSP_balance_after).toBe(0);
    expect(delegatee_SPSP_OUT_balance_after).toBe(0);
    expect(delegatee_SPSP_IN_balance_after).toBe(0);

    expect(sysacc_SPSP_OUT_balance_after).toBe(0);
    expect(sysacc_SPSP_IN_balance_after).toBe(0);
});

test.dbOnly('Token delegation using posting key succeeds.', async () => {
    const amount_to_delegate = 50;

    await expect(
        fixture.opsHelper.processOp(
            'delegate_tokens',
            delegator,
            {
                token: 'SPSP',
                to: delegatee,
                qty: amount_to_delegate,
            },
            { is_active: false },
        ),
    ).resolves.toBeUndefined();

    const active_delegation_record = (await fixture.testHelper.getActiveDelegationRecord(delegator, delegatee, TOKENS.SPSP))!;

    const delegator_SPSP_balance_after = (await fixture.testHelper.getDummyToken(delegator, TOKENS.SPSP))!.balance;
    const delegator_SPSP_OUT_balance_after = (await fixture.testHelper.getDummyToken(delegator, TOKENS.SPSP_OUT))!.balance;
    const delegator_SPSP_IN_balance_after = (await fixture.testHelper.getDummyToken(delegator, TOKENS.SPSP_IN))!.balance;

    const delegatee_SPSP_balance_after = (await fixture.testHelper.getDummyToken(delegatee, TOKENS.SPSP))!.balance;
    const delegatee_SPSP_OUT_balance_after = (await fixture.testHelper.getDummyToken(delegatee, TOKENS.SPSP_OUT))!.balance;
    const delegatee_SPSP_IN_balance_after = (await fixture.testHelper.getDummyToken(delegatee, TOKENS.SPSP_IN))!.balance;

    const sysacc_SPSP_OUT_balance_after = (await fixture.testHelper.getDummyToken(DELEGATION_ACCOUNT, TOKENS.SPSP_OUT))!.balance;
    const sysacc_SPSP_IN_balance_after = (await fixture.testHelper.getDummyToken(DELEGATION_ACCOUNT, TOKENS.SPSP_IN))!.balance;

    expect(active_delegation_record).toBeTruthy();

    expect(delegator_SPSP_balance_after).toBe(initial_staked_amount);
    expect(delegator_SPSP_OUT_balance_after).toBe(amount_to_delegate);
    expect(delegator_SPSP_IN_balance_after).toBe(0);

    expect(delegatee_SPSP_balance_after).toBe(0);
    expect(delegatee_SPSP_OUT_balance_after).toBe(0);
    expect(delegatee_SPSP_IN_balance_after).toBe(amount_to_delegate);

    expect(sysacc_SPSP_OUT_balance_after).toBe(-amount_to_delegate);
    expect(sysacc_SPSP_IN_balance_after).toBe(-amount_to_delegate);
});
