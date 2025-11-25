import { emoji_payload, garbage_payload } from '../../../__tests__/db-helpers';
import { container } from '../../../__tests__/test-composition-root';
import { Fixture } from '../../../__tests__/action-fixture';
import { TransitionCfg } from '../../features/transition';
import { TOKENS } from '../../features/tokens';
import { CleanupLiteAccountsTransitionAction } from './cleanup_lite_accounts';

const supportAccount = CleanupLiteAccountsTransitionAction.SUPPORT_ACCOUNT;
const liteAccounts = [
    { account: 'some_account1231', spsp: 10204, sps: 0 },
    { account: 'neophyte_5622', spsp: 0, sps: 12345 },
    { account: 'lite_account2', spsp: 1245, sps: 523 },
    { account: 'lite_account3', spsp: 0, sps: 0 },
];

const fixture = container.resolve(Fixture);
let transitionPoints: TransitionCfg | null = null;

beforeAll(async () => {
    await fixture.init();
});

beforeEach(async () => {
    await fixture.restore();

    await fixture.testHelper.setHiveAccount(supportAccount);
    for (const account of liteAccounts) {
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

test.dbOnly('Garbage data for transition_cleanup_lite_accounts does not crash.', () => {
    return expect(fixture.opsHelper.processVirtualOp('transition_cleanup_lite_accounts', 'steemmonsters', garbage_payload)).resolves.toBeUndefined();
});

test.dbOnly('Lots of emoji for transition_cleanup_lite_accounts does not crash.', () => {
    return expect(fixture.opsHelper.processVirtualOp('transition_cleanup_lite_accounts', 'steemmonsters', emoji_payload)).resolves.toBeUndefined();
});

test.dbOnly('transition_cleanup_lite_accounts works on block num', async () => {
    await fixture.opsHelper.processVirtualOp(
        'transition_cleanup_lite_accounts',
        '$TRANSITIONS',
        {
            block_num: transitionPoints!.transition_points.validator_transition_cleanup,
        },
        {
            block_num: transitionPoints!.transition_points.validator_transition_cleanup,
        },
    );

    // Make sure all of the lite accounts have no sps or spsp
    for (const account of liteAccounts) {
        const sps = await fixture.testHelper.getDummyToken(account.account, TOKENS.SPS);
        const spsp = await fixture.testHelper.getDummyToken(account.account, TOKENS.SPSP);
        expect(sps?.balance ?? 0).toEqual(0);
        expect(spsp?.balance ?? 0).toEqual(0);
    }

    // Make sure the sl-cs-lite account has all the tokens
    const slCsLiteSps = await fixture.testHelper.getDummyToken(supportAccount, TOKENS.SPS);
    const slCsLiteSpsp = await fixture.testHelper.getDummyToken(supportAccount, TOKENS.SPSP);
    expect(slCsLiteSps?.balance ?? 0).toBeGreaterThan(0);
    // shouldnt have any spsp
    expect(slCsLiteSpsp?.balance ?? 0).toBe(0);
});
