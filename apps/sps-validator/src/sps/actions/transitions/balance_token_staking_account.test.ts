import { emoji_payload, garbage_payload } from '../../../__tests__/db-helpers';
import { container } from '../../../__tests__/test-composition-root';
import { Fixture } from '../../../__tests__/action-fixture';
import { TransitionCfg } from '../../features/transition';
import { TOKENS } from '../../features/tokens';
import { BalanceTokenStakingAccountTransitionAction } from './balance_token_staking_account';
import { RawResult } from '@steem-monsters/splinterlands-validator';

const spsFromAccount = BalanceTokenStakingAccountTransitionAction.SPS_FROM_ACCOUNT;
const testAccounts = [
    { account: 'abcdef', spsp: 10204, sps: 0 },
    { account: 'abcdef1', spsp: 3423, sps: 12345 },
    { account: 'abcdef2', spsp: 1235, sps: 523 },
    { account: 'abcdef3', spsp: 7777, sps: 0 },
];
const difference = 1257;
testAccounts.push({ account: spsFromAccount, sps: difference, spsp: 0 });
const stakingAccountBalance = testAccounts.reduce((acc, cur) => acc + cur.spsp, 0) - difference;
testAccounts.push({ account: '$TOKEN_STAKING', spsp: -stakingAccountBalance, sps: stakingAccountBalance });

const fixture = container.resolve(Fixture);
let transitionPoints: TransitionCfg | null = null;

beforeAll(async () => {
    await fixture.init();
});

beforeEach(async () => {
    await fixture.restore();

    for (const account of testAccounts) {
        await fixture.testHelper.setHiveAccount(account.account);
        await fixture.testHelper.setStaked(account.account, account.spsp);
        await fixture.testHelper.setLiquidSPSBalance(account.account, account.sps);
        // todo: should we "stake" the correct way?
    }

    await fixture.loader.load();
    transitionPoints = container.resolve(TransitionCfg);
});

afterAll(async () => {
    await fixture.dispose();
});

test.dbOnly('Garbage data for transition_balance_token_staking_spsp does not crash.', () => {
    return expect(fixture.opsHelper.processVirtualOp('transition_balance_token_staking_spsp', 'steemmonsters', garbage_payload)).resolves.toBeUndefined();
});

test.dbOnly('Lots of emoji for transition_balance_token_staking_spsp does not crash.', () => {
    return expect(fixture.opsHelper.processVirtualOp('transition_balance_token_staking_spsp', 'steemmonsters', emoji_payload)).resolves.toBeUndefined();
});

test.dbOnly('transition_balance_token_staking_spsp works on block num', async () => {
    await fixture.opsHelper.processVirtualOp(
        'transition_balance_token_staking_spsp',
        '$TRANSITIONS',
        {
            block_num: transitionPoints!.transition_points.validator_transition_cleanup,
        },
        {
            block_num: transitionPoints!.transition_points.validator_transition_cleanup,
        },
    );

    // make sure the from account has zero balance now
    const fromAccount = await fixture.testHelper.getDummyToken(spsFromAccount, TOKENS.SPS);
    expect(fromAccount).toBeDefined();
    expect(fromAccount!.balance).toBe(0);

    // make sure the token staking account balances spsp to players spsp
    const result = await fixture.handle.knexInstance.raw<RawResult<{ spsp_difference: string | number }>>(`
        select
            (
            SELECT
                SUM(balance)
            FROM
                balances
            WHERE token = 'SPSP' AND player NOT LIKE '$%' AND player != 'null'
            )
            +
            (
            SELECT
                balance
            FROM
                balances
            WHERE token = 'SPSP' AND player = '$TOKEN_STAKING'
        ) AS spsp_difference
    `);
    expect(result.rows.length).toBe(1);
    expect(Number(result.rows[0].spsp_difference)).toBe(0);

    // make sure the staking account spsp/sps balance.
    const stakingAccountSpsp = await fixture.testHelper.getDummyToken('$TOKEN_STAKING', TOKENS.SPSP);
    const stakingAccountSps = await fixture.testHelper.getDummyToken('$TOKEN_STAKING', TOKENS.SPS);
    expect(stakingAccountSpsp).toBeDefined();
    expect(stakingAccountSps).toBeDefined();
    expect(stakingAccountSps!.balance + stakingAccountSpsp!.balance).toBe(0);
});
