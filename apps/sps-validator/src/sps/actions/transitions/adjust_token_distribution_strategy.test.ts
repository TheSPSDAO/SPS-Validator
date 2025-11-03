import { emoji_payload, garbage_payload } from '../../../__tests__/db-helpers';
import { container } from '../../../__tests__/test-composition-root';
import { Fixture } from '../../../__tests__/action-fixture';
import { TransitionPoints } from '../../features/transition';
import { SPS_STAKING_CONFIG, SPS_VALIDATOR_REWARDS_CONFIG, TRANSFERS } from './adjust_token_distribution_strategy';
import { TOKENS } from '../../features/tokens';

const fixture = container.resolve(Fixture);
let transitionPoints: TransitionPoints | null = null;

beforeAll(async () => {
    await fixture.init();
});

beforeEach(async () => {
    await fixture.restore();
    await fixture.testHelper.insertDefaultConfiguration();
    await fixture.loader.load();
    transitionPoints = container.resolve(TransitionPoints);
});

afterAll(async () => {
    await fixture.dispose();
});

test.dbOnly('Garbage data for transition_adjust_token_distribution_strategy does not crash.', () => {
    return expect(fixture.opsHelper.processVirtualOp('transition_adjust_token_distribution_strategy', 'steemmonsters', garbage_payload)).resolves.toBeUndefined();
});

test.dbOnly('Lots of emoji for transition_adjust_token_distribution_strategy does not crash.', () => {
    return expect(fixture.opsHelper.processVirtualOp('transition_adjust_token_distribution_strategy', 'steemmonsters', emoji_payload)).resolves.toBeUndefined();
});

test.dbOnly('transition_adjust_token_distribution_strategy works on block num', async () => {
    const uniswapBalanceBefore = (await fixture.testHelper.getDummyToken('$UNCLAIMED_UNISWAP_REWARDS', TOKENS.SPS))?.balance ?? 0;
    const uniswapExpectedDecrease = TRANSFERS.reduce((acc, [_to, amount]) => acc + amount, 0);
    const balancesBefore = await Promise.all(
        TRANSFERS.map(async ([to, amount]) => {
            return {
                to,
                expectedIncrease: amount,
                balance: (await fixture.testHelper.getDummyToken(to, TOKENS.SPS))?.balance ?? 0,
            };
        }),
    );

    await fixture.opsHelper.processVirtualOp(
        'transition_adjust_token_distribution_strategy',
        '$TRANSITIONS',
        {
            block_num: transitionPoints!.transition_points.adjust_token_distribution_strategy,
        },
        {
            block_num: transitionPoints!.transition_points.adjust_token_distribution_strategy,
        },
    );

    const uniswapBalanceAfter = (await fixture.testHelper.getDummyToken('$UNCLAIMED_UNISWAP_REWARDS', TOKENS.SPS))?.balance ?? 0;
    const balancesAfter = await Promise.all(
        TRANSFERS.map(async ([to, _amount]) => {
            return {
                to,
                balance: (await fixture.testHelper.getDummyToken(to, TOKENS.SPS))?.balance ?? 0,
            };
        }),
    );
    expect(uniswapBalanceBefore - uniswapBalanceAfter).toBe(uniswapExpectedDecrease);
    for (const before of balancesBefore) {
        const after = balancesAfter.find((x) => x.to === before.to)!;
        expect(after.balance - before.balance).toBe(before.expectedIncrease);
    }

    expect(fixture.loader.pools?.['staking_rewards']).toMatchObject(SPS_STAKING_CONFIG);
    expect(fixture.loader.pools?.['validator_rewards']).toMatchObject(SPS_VALIDATOR_REWARDS_CONFIG);
});
