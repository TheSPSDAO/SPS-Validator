import { emoji_payload, garbage_payload } from '../../../__tests__/db-helpers';
import { container } from '../../../__tests__/test-composition-root';
import { Fixture } from '../../../__tests__/action-fixture';
import { ConfigEntity } from '@steem-monsters/splinterlands-validator';
import { TOKENS } from '../../features/tokens';

const fixture = container.resolve(Fixture);

beforeAll(async () => {
    await fixture.init();
});

beforeEach(async () => {
    await fixture.restore();

    // The following is required to prevent a null exception when pool_settings is fetched in stake_sps.ts
    await fixture.handle.query(ConfigEntity).insertItem({
        group_name: 'sps',
        group_type: 'object',
        name: 'staking_rewards',
        index: 0,
        value_type: 'object',
        value: JSON.stringify({
            tokens_per_block: 8.56164,
            reduction_blocks: 864000,
            reduction_pct: 1,
            start_block: 56186000,
            unstaking_interval_seconds: 1,
            unstaking_periods: 1,
        }),
    });

    await fixture.loader.load();
});

afterAll(async () => {
    await fixture.dispose();
});

test.dbOnly('Garbage data for stake_tokens does not crash.', () => {
    return expect(fixture.opsHelper.processOp('stake_tokens', 'steemmonsters', garbage_payload)).resolves.toBeUndefined();
});

test.dbOnly('Lots of emoji for stake_tokens does not crash.', () => {
    return expect(fixture.opsHelper.processOp('stake_tokens', 'steemmonsters', emoji_payload)).resolves.toBeUndefined();
});

test.dbOnly('Simple stake tokens.', async () => {
    const account = 'steemmonsters';
    await fixture.testHelper.setStaked(account, 90);
    await fixture.testHelper.setLiquidSPSBalance(account, 100);

    const staked_balance_before = (await fixture.testHelper.getDummyToken(account, TOKENS.SPSP))!.balance;
    const amount_to_stake = 100;
    await expect(
        fixture.opsHelper.processOp('stake_tokens', account, {
            token: TOKENS.SPS,
            to_player: account,
            qty: amount_to_stake,
        }),
    ).resolves.toBeUndefined();

    const staked_balance_after = (await fixture.testHelper.getDummyToken(account, TOKENS.SPSP))!.balance;
    const liquid_balance_after = (await fixture.testHelper.getDummyToken(account, TOKENS.SPS))!.balance;
    const change_in_stake = staked_balance_after - staked_balance_before;
    expect(change_in_stake).toBe(amount_to_stake);
    expect(liquid_balance_after).toBe(100 - amount_to_stake);
});

test.dbOnly('Simple stake tokens works even if to_player is not assigned.', async () => {
    const account = 'steemmonsters';
    await fixture.testHelper.setStaked(account, 90);
    await fixture.testHelper.setLiquidSPSBalance(account, 100);

    const staked_balance_before = (await fixture.testHelper.getDummyToken(account, TOKENS.SPSP))!.balance;
    const amount_to_stake = 100;
    await expect(
        fixture.opsHelper.processOp('stake_tokens', account, {
            token: TOKENS.SPS,
            qty: amount_to_stake,
        }),
    ).resolves.toBeUndefined();

    const staked_balance_after = (await fixture.testHelper.getDummyToken(account, TOKENS.SPSP))!.balance;
    const liquid_balance_after = (await fixture.testHelper.getDummyToken(account, TOKENS.SPS))!.balance;
    const change_in_stake = staked_balance_after - staked_balance_before;
    expect(change_in_stake).toBe(amount_to_stake);
    expect(liquid_balance_after).toBe(100 - amount_to_stake);
});

test.dbOnly('Simple stake SPS with posting auth.', async () => {
    const account = 'steemmonsters';
    await fixture.testHelper.setStaked(account, 90);
    await fixture.testHelper.setLiquidSPSBalance(account, 100);

    const staked_balance_before = (await fixture.testHelper.getDummyToken(account, TOKENS.SPSP))!.balance;
    const amount_to_stake = 100;
    await expect(
        fixture.opsHelper.processOp(
            'stake_tokens',
            account,
            {
                token: TOKENS.SPS,
                qty: amount_to_stake,
            },
            { is_active: false },
        ),
    ).resolves.toBeUndefined();

    const staked_balance_after = (await fixture.testHelper.getDummyToken(account, TOKENS.SPSP))!.balance;
    const liquid_balance_after = (await fixture.testHelper.getDummyToken(account, TOKENS.SPS))!.balance;
    const change_in_stake = staked_balance_after - staked_balance_before;
    expect(change_in_stake).toBe(amount_to_stake);
    expect(liquid_balance_after).toBe(100 - amount_to_stake);
});

test.dbOnly('Stake tokens fails if to_player is another player and signed with posting key.', async () => {
    const account = 'steemmonsters';
    const other_account = 'steemmonsters2';
    await fixture.testHelper.setLiquidSPSBalance(account, 100);
    await fixture.testHelper.setStaked(account, 50);
    await fixture.testHelper.setLiquidSPSBalance(other_account, 100);
    await fixture.testHelper.setStaked(other_account, 50);
    const amount_to_stake = 100;

    // Ensure error is thrown
    await expect(
        fixture.opsHelper.processOp(
            'stake_tokens',
            account,
            {
                token: TOKENS.SPS,
                qty: amount_to_stake,
                to_player: other_account,
            },
            { is_active: false },
        ),
    ).resolves.toBeUndefined();

    // Ensure balances are unchanged
    const account_staked_balance_after = (await fixture.testHelper.getDummyToken(account, TOKENS.SPSP))!.balance;
    const account_liquid_balance_after = (await fixture.testHelper.getDummyToken(account, TOKENS.SPS))!.balance;

    const other_account_staked_balance_after = (await fixture.testHelper.getDummyToken(other_account, TOKENS.SPSP))!.balance;
    const other_account_liquid_balance_after = (await fixture.testHelper.getDummyToken(other_account, TOKENS.SPS))!.balance;

    expect(account_staked_balance_after).toBe(50);
    expect(account_liquid_balance_after).toBe(100);
    expect(other_account_staked_balance_after).toBe(50);
    expect(other_account_liquid_balance_after).toBe(100);
});

test.dbOnly('Stake tokens works if to_player is another player and signed with active key.', async () => {
    const account = 'steemmonsters';
    const other_account = 'steemmonsters2';
    await fixture.testHelper.setLiquidSPSBalance(account, 100);
    await fixture.testHelper.setStaked(account, 50);
    await fixture.testHelper.setLiquidSPSBalance(other_account, 100);
    await fixture.testHelper.setStaked(other_account, 50);
    const amount_to_stake = 100;

    await expect(
        fixture.opsHelper.processOp(
            'stake_tokens',
            account,
            {
                token: TOKENS.SPS,
                qty: amount_to_stake,
                to_player: other_account,
            },
            { is_active: true },
        ),
    ).resolves.toBeUndefined();

    // Ensure balances are unchanged
    const account_staked_balance_after = (await fixture.testHelper.getDummyToken(account, TOKENS.SPSP))?.balance;
    const account_liquid_balance_after = (await fixture.testHelper.getDummyToken(account, TOKENS.SPS))?.balance;

    const other_account_staked_balance_after = (await fixture.testHelper.getDummyToken(other_account, TOKENS.SPSP))?.balance;
    const other_account_liquid_balance_after = (await fixture.testHelper.getDummyToken(other_account, TOKENS.SPS))?.balance;

    expect(account_staked_balance_after).toBe(50);
    expect(account_liquid_balance_after).toBe(0);
    expect(other_account_staked_balance_after).toBe(150);
    expect(other_account_liquid_balance_after).toBe(100);
});

test.dbOnly('Stake more than available balance fails.', async () => {
    const account = 'steemmonsters';
    await fixture.testHelper.setStaked(account, 100);
    await fixture.testHelper.setLiquidSPSBalance(account, 50);
    const staked_balance_before = (await fixture.testHelper.getDummyToken(account, TOKENS.SPSP))!.balance;
    const amount_to_stake = 100;

    await expect(
        fixture.opsHelper.processOp('stake_tokens', account, {
            token: TOKENS.SPS,
            qty: amount_to_stake,
        }),
    ).resolves.toBeUndefined();
    const staked_balance_after = (await fixture.testHelper.getDummyToken(account, TOKENS.SPSP))!.balance;

    expect(staked_balance_after).toBe(staked_balance_before);
});

test.dbOnly('Stake unrelated tokens fails.', async () => {
    const account = 'steemmonsters';
    await fixture.testHelper.setStaked(account, 100);
    await fixture.testHelper.setLiquidSPSBalance(account, 100);
    const staked_balance_before = (await fixture.testHelper.getDummyToken(account, TOKENS.SPSP))!.balance;
    const amount_to_stake = 100;

    await expect(
        fixture.opsHelper.processOp('stake_tokens', account, {
            token: TOKENS.SPS + 'but_not_really',
            qty: amount_to_stake,
        }),
    ).resolves.toBeUndefined();
    const staked_balance_after = (await fixture.testHelper.getDummyToken(account, TOKENS.SPSP))!.balance;

    expect(staked_balance_after).toBe(staked_balance_before);
});

test.dbOnly('Stake negative amount fails.', async () => {
    const account = 'steemmonsters';
    await fixture.testHelper.setStaked(account, 90);
    await fixture.testHelper.setLiquidSPSBalance(account, 100);

    const staked_balance_before = (await fixture.testHelper.getDummyToken(account, TOKENS.SPSP))!.balance;
    const amount_to_stake = -90;
    await expect(
        fixture.opsHelper.processOp('stake_tokens', account, {
            token: TOKENS.SPS,
            qty: amount_to_stake,
        }),
    ).resolves.toBeUndefined();

    const staked_balance_after = (await fixture.testHelper.getDummyToken(account, TOKENS.SPSP))!.balance;
    const liquid_balance_after = (await fixture.testHelper.getDummyToken(account, TOKENS.SPS))!.balance;

    const change_in_stake = staked_balance_after - staked_balance_before;
    expect(change_in_stake).toBe(0);
    expect(liquid_balance_after).toBe(100);
});

test.dbOnly('stake tokens from system accounts from admin with negative balance fails', async () => {
    const sysAccount = '$SOME_SYSTEM_ACCOUNT';
    const account = 'someplayer';
    const someAdmin = 'someadmin';
    await fixture.testHelper.insertExistingAdmins([someAdmin]);
    await fixture.loader.load();

    const liquid_balance_before = (await fixture.testHelper.getDummyToken(sysAccount, TOKENS.SPS))?.balance ?? 0;
    const staked_balance_before = (await fixture.testHelper.getDummyToken(account, TOKENS.SPSP))?.balance ?? 0;
    await fixture.opsHelper.processOp('stake_tokens', someAdmin, {
        token: TOKENS.SPS,
        qty: 7,
        to_player: account,
        from_player: sysAccount,
    });
    const liquid_balance_after = (await fixture.testHelper.getDummyToken(sysAccount, TOKENS.SPS))?.balance ?? 0;
    const staked_balance_after = (await fixture.testHelper.getDummyToken(account, TOKENS.SPSP))?.balance ?? 0;

    expect(liquid_balance_before).toBe(0);
    expect(staked_balance_before).toBe(0);
    expect(liquid_balance_after).toBe(0);
    expect(staked_balance_after).toBe(0);
});

test.dbOnly('stake tokens from system account from non-admin does not work', async () => {
    const sysAccount = '$SOME_SYSTEM_ACCOUNT';
    const account = 'someplayer';
    const someAdmin = 'someadmin';
    await fixture.loader.load();

    const liquid_balance_before = (await fixture.testHelper.getDummyToken(sysAccount, TOKENS.SPS))?.balance ?? 0;
    const staked_balance_before = (await fixture.testHelper.getDummyToken(account, TOKENS.SPSP))?.balance ?? 0;
    await fixture.opsHelper.processOp('stake_tokens', someAdmin, {
        token: TOKENS.SPS,
        qty: 7,
        to_player: account,
        from_player: sysAccount,
    });
    const liquid_balance_after = (await fixture.testHelper.getDummyToken(sysAccount, TOKENS.SPS))?.balance ?? 0;
    const staked_balance_after = (await fixture.testHelper.getDummyToken(account, TOKENS.SPSP))?.balance ?? 0;

    expect(liquid_balance_before).toBe(0);
    expect(staked_balance_before).toBe(0);
    expect(liquid_balance_after).toBe(0);
    expect(staked_balance_after).toBe(0);
});

test.dbOnly('stake tokens from self cannot go negative', async () => {
    const account = 'someplayer';
    const somePlayer = 'someotherplayer';
    await fixture.loader.load();

    const liquid_balance_before = (await fixture.testHelper.getDummyToken(somePlayer, TOKENS.SPS))?.balance ?? 0;
    const staked_balance_before = (await fixture.testHelper.getDummyToken(account, TOKENS.SPSP))?.balance ?? 0;
    await fixture.opsHelper.processOp('stake_tokens', somePlayer, {
        token: TOKENS.SPS,
        qty: 7,
        to_player: account,
    });
    const liquid_balance_after = (await fixture.testHelper.getDummyToken(somePlayer, TOKENS.SPS))?.balance ?? 0;
    const staked_balance_after = (await fixture.testHelper.getDummyToken(account, TOKENS.SPSP))?.balance ?? 0;

    expect(liquid_balance_before).toBe(0);
    expect(staked_balance_before).toBe(0);
    expect(liquid_balance_after).toBe(0);
    expect(staked_balance_after).toBe(0);
});

test.dbOnly('stake tokens from someone else does not work', async () => {
    const account = 'someplayer';
    const somePlayer = 'someotherplayer';
    const someTarget = 'sometarget';
    await fixture.loader.load();

    await fixture.testHelper.setDummyToken(someTarget, 100, TOKENS.SPS);
    await fixture.testHelper.setDummyToken(somePlayer, 100, TOKENS.SPS);

    const liquid_balance_before = (await fixture.testHelper.getDummyToken(someTarget, TOKENS.SPS))?.balance ?? 0;
    const staked_balance_before = (await fixture.testHelper.getDummyToken(account, TOKENS.SPSP))?.balance ?? 0;
    await fixture.opsHelper.processOp('stake_tokens', somePlayer, {
        token: TOKENS.SPS,
        qty: 7,
        to_player: account,
        from_player: someTarget,
    });
    const liquid_balance_after = (await fixture.testHelper.getDummyToken(someTarget, TOKENS.SPS))?.balance ?? 0;
    const staked_balance_after = (await fixture.testHelper.getDummyToken(account, TOKENS.SPSP))?.balance ?? 0;

    expect(liquid_balance_before).toBe(100);
    expect(staked_balance_before).toBe(0);
    expect(liquid_balance_after).toBe(100);
    expect(staked_balance_after).toBe(0);
});
