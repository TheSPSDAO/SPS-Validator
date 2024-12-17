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
const amount_delegated = 100;

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
    await fixture.testHelper.setDelegatedOut(DELEGATION_ACCOUNT, 0);
    await fixture.testHelper.setDelegatedIn(DELEGATION_ACCOUNT, 0);
    await fixture.testHelper.setActiveDelegationRecord(delegator, delegatee, TOKENS.SPSP, amount_delegated);

    await fixture.loader.load();
});

afterAll(async () => {
    await fixture.dispose();
});

test.dbOnly('Garbage data for undelegate_tokens does not crash.', () => {
    return expect(fixture.opsHelper.processOp('undelegate_tokens', 'steemmonsters', garbage_payload)).resolves.toBeUndefined();
});

test.dbOnly('Lots of emoji for undelegate_tokens does not crash.', () => {
    return expect(fixture.opsHelper.processOp('undelegate_tokens', 'steemmonsters', emoji_payload)).resolves.toBeUndefined();
});

test.dbOnly('Simple undelegate tokens.', async () => {
    const amount_to_undelegate = 50;
    const block_time = new Date();
    // there is an undelegation cooldown, so set this block_time beyond that.
    block_time.setTime(block_time.getTime() + 8 * 24 * 60 * 60 * 1000);
    await expect(
        fixture.opsHelper.processOp(
            'undelegate_tokens',
            delegator,
            {
                token: 'SPSP',
                from: delegatee,
                qty: amount_to_undelegate,
            },
            { block_time },
        ),
    ).resolves.toBeUndefined();

    const delegation_amount_after = amount_delegated - amount_to_undelegate;
    const active_delegation_record_after = (await fixture.testHelper.getActiveDelegationRecord(delegator, delegatee, TOKENS.SPSP))!;

    const delegator_SPSP_balance_after = (await fixture.testHelper.getDummyToken(delegator, TOKENS.SPSP))!.balance;
    const delegator_SPSP_OUT_balance_after = (await fixture.testHelper.getDummyToken(delegator, TOKENS.SPSP_OUT))!.balance;
    const delegator_SPSP_IN_balance_after = (await fixture.testHelper.getDummyToken(delegator, TOKENS.SPSP_IN))!.balance;

    const delegatee_SPSP_balance_after = (await fixture.testHelper.getDummyToken(delegatee, TOKENS.SPSP))!.balance;
    const delegatee_SPSP_OUT_balance_after = (await fixture.testHelper.getDummyToken(delegatee, TOKENS.SPSP_OUT))!.balance;
    const delegatee_SPSP_IN_balance_after = (await fixture.testHelper.getDummyToken(delegatee, TOKENS.SPSP_IN))!.balance;

    const sysacc_SPSP_OUT_balance_after = (await fixture.testHelper.getDummyToken(DELEGATION_ACCOUNT, TOKENS.SPSP_OUT))!.balance;
    const sysacc_SPSP_IN_balance_after = (await fixture.testHelper.getDummyToken(DELEGATION_ACCOUNT, TOKENS.SPSP_IN))!.balance;

    expect(Number(active_delegation_record_after.amount)).toBe(delegation_amount_after);
    expect(active_delegation_record_after.last_undelegation_date).toBeTruthy();
    expect(active_delegation_record_after.last_delegation_tx).toBeTruthy();

    // should never change
    expect(delegator_SPSP_balance_after).toBe(initial_staked_amount);
    // should be decreased by undelegation amount
    expect(delegator_SPSP_OUT_balance_after).toBe(delegation_amount_after);
    expect(delegator_SPSP_IN_balance_after).toBe(0);

    expect(delegatee_SPSP_balance_after).toBe(0);
    expect(delegatee_SPSP_OUT_balance_after).toBe(0);
    expect(delegatee_SPSP_IN_balance_after).toBe(delegation_amount_after);

    expect(sysacc_SPSP_OUT_balance_after).toBe(-delegation_amount_after);
    expect(sysacc_SPSP_IN_balance_after).toBe(-delegation_amount_after);
});

test.dbOnly('Simple undelegate tokens with authority.', async () => {
    const amount_to_undelegate = 50;
    const block_time = new Date();
    // there is an undelegation cooldown, so set this block_time beyond that.
    block_time.setTime(block_time.getTime() + 8 * 24 * 60 * 60 * 1000);
    await expect(
        fixture.opsHelper.processOp(
            'undelegate_tokens',
            delegatorWithAuthority,
            {
                token: 'SPSP',
                from: delegatee,
                qty: amount_to_undelegate,
                player: delegator,
            },
            { block_time },
        ),
    ).resolves.toBeUndefined();

    const delegation_amount_after = amount_delegated - amount_to_undelegate;
    const active_delegation_record_after = (await fixture.testHelper.getActiveDelegationRecord(delegator, delegatee, TOKENS.SPSP))!;

    const delegator_SPSP_balance_after = (await fixture.testHelper.getDummyToken(delegator, TOKENS.SPSP))!.balance;
    const delegator_SPSP_OUT_balance_after = (await fixture.testHelper.getDummyToken(delegator, TOKENS.SPSP_OUT))!.balance;
    const delegator_SPSP_IN_balance_after = (await fixture.testHelper.getDummyToken(delegator, TOKENS.SPSP_IN))!.balance;

    const delegatee_SPSP_balance_after = (await fixture.testHelper.getDummyToken(delegatee, TOKENS.SPSP))!.balance;
    const delegatee_SPSP_OUT_balance_after = (await fixture.testHelper.getDummyToken(delegatee, TOKENS.SPSP_OUT))!.balance;
    const delegatee_SPSP_IN_balance_after = (await fixture.testHelper.getDummyToken(delegatee, TOKENS.SPSP_IN))!.balance;

    const sysacc_SPSP_OUT_balance_after = (await fixture.testHelper.getDummyToken(DELEGATION_ACCOUNT, TOKENS.SPSP_OUT))!.balance;
    const sysacc_SPSP_IN_balance_after = (await fixture.testHelper.getDummyToken(DELEGATION_ACCOUNT, TOKENS.SPSP_IN))!.balance;

    expect(Number(active_delegation_record_after.amount)).toBe(delegation_amount_after);
    expect(active_delegation_record_after.last_undelegation_date).toBeTruthy();
    expect(active_delegation_record_after.last_undelegation_tx).toBeTruthy();

    // should never change
    expect(delegator_SPSP_balance_after).toBe(initial_staked_amount);
    // should be decreased by undelegation amount
    expect(delegator_SPSP_OUT_balance_after).toBe(delegation_amount_after);
    expect(delegator_SPSP_IN_balance_after).toBe(0);

    expect(delegatee_SPSP_balance_after).toBe(0);
    expect(delegatee_SPSP_OUT_balance_after).toBe(0);
    expect(delegatee_SPSP_IN_balance_after).toBe(delegation_amount_after);

    expect(sysacc_SPSP_OUT_balance_after).toBe(-delegation_amount_after);
    expect(sysacc_SPSP_IN_balance_after).toBe(-delegation_amount_after);
});

test.dbOnly('undelegate without authority fails.', async () => {
    const amount_to_undelegate = amount_delegated;
    const block_time = new Date();
    // there is an undelegation cooldown, so set this block_time beyond that.
    block_time.setTime(block_time.getTime() + 8 * 24 * 60 * 60 * 1000);
    await expect(
        fixture.opsHelper.processOp(
            'undelegate_tokens',
            delegatorWithoutAuthority,
            {
                token: 'SPSP',
                from: delegatee,
                qty: amount_to_undelegate,
                player: delegator,
            },
            { block_time },
        ),
    ).resolves.toBeUndefined();

    const active_delegation_record_after = (await fixture.testHelper.getActiveDelegationRecord(delegator, delegatee, TOKENS.SPSP))!;

    // No changes
    expect(Number(active_delegation_record_after.amount)).toBe(amount_delegated);
    expect(active_delegation_record_after.last_undelegation_date).toBeNull();
    expect(active_delegation_record_after.last_undelegation_tx).toBeNull();
});

test.dbOnly('undelegate more than delegated amount fails.', async () => {
    const amount_to_undelegate = amount_delegated * 2;
    const block_time = new Date();
    // there is an undelegation cooldown, so set this block_time beyond that.
    block_time.setTime(block_time.getTime() + 8 * 24 * 60 * 60 * 1000);
    await expect(
        fixture.opsHelper.processOp(
            'undelegate_tokens',
            delegator,
            {
                token: 'SPSP',
                from: delegatee,
                qty: amount_to_undelegate,
            },
            { block_time },
        ),
    ).resolves.toBeUndefined();

    const active_delegation_record_after = (await fixture.testHelper.getActiveDelegationRecord(delegator, delegatee, TOKENS.SPSP))!;

    // No changes
    expect(Number(active_delegation_record_after.amount)).toBe(amount_delegated);
    expect(active_delegation_record_after.last_undelegation_date).toBeNull();
    expect(active_delegation_record_after.last_undelegation_tx).toBeNull();
});

test.dbOnly('undelegate negative amount fails.', async () => {
    const amount_to_undelegate = amount_delegated * -1;
    const block_time = new Date();
    // there is an undelegation cooldown, so set this block_time beyond that.
    block_time.setTime(block_time.getTime() + 8 * 24 * 60 * 60 * 1000);
    await expect(
        fixture.opsHelper.processOp(
            'undelegate_tokens',
            delegator,
            {
                token: 'SPSP',
                from: delegatee,
                qty: amount_to_undelegate,
            },
            { block_time },
        ),
    ).resolves.toBeUndefined();

    const active_delegation_record_after = (await fixture.testHelper.getActiveDelegationRecord(delegator, delegatee, TOKENS.SPSP))!;

    // No changes
    expect(Number(active_delegation_record_after.amount)).toBe(amount_delegated);
    expect(active_delegation_record_after.last_undelegation_date).toBeNull();
    expect(active_delegation_record_after.last_undelegation_tx).toBeNull();
});

test.dbOnly('Token delegation using posting key succeeds.', async () => {
    const amount_to_undelegate = amount_delegated;
    const block_time = new Date();
    // there is an undelegation cooldown, so set this block_time beyond that.
    block_time.setTime(block_time.getTime() + 8 * 24 * 60 * 60 * 1000);
    await expect(
        fixture.opsHelper.processOp(
            'undelegate_tokens',
            delegator,
            {
                token: 'SPSP',
                from: delegatee,
                qty: amount_to_undelegate,
            },
            { is_active: false, block_time },
        ),
    ).resolves.toBeUndefined();

    const active_delegation_record_after = (await fixture.testHelper.getActiveDelegationRecord(delegator, delegatee, TOKENS.SPSP))!;

    expect(Number(active_delegation_record_after.amount)).toBe(0);
    expect(active_delegation_record_after.last_undelegation_date).toBeTruthy();
    expect(active_delegation_record_after.last_undelegation_tx).toBeTruthy();
});
