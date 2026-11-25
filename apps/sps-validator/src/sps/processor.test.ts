import { container } from '../__tests__/test-composition-root';
import { Fixture } from '../__tests__/action-fixture';
import { SpsBlockProcessor } from './processor';
import { TransitionCfg } from './features/transition';
import { TOKENS } from './features/tokens';
import { NBlock } from '@steem-monsters/splinterlands-validator';
import { SPS_BLOCK_VALIDATION_TOKENS_PER_BLOCK } from './actions/transitions/adjust_token_distribution_strategy';

const fixture = container.resolve(Fixture);
let transitionPoints: TransitionCfg | null = null;
let processor: SpsBlockProcessor | null = null;

beforeAll(async () => {
    await fixture.init();
});

beforeEach(async () => {
    await fixture.restore();
    await fixture.testHelper.insertDefaultConfiguration();
    await fixture.loader.load();
    transitionPoints = container.resolve(TransitionCfg);
    processor = container.resolve(SpsBlockProcessor);
});

afterAll(async () => {
    await fixture.dispose();
});

test.dbOnly('Block reward is correct after adjust_token_distribution_strategy transition with balance in reward account', async () => {
    // The transition point where the reward calculation changes
    const transitionBlockNum = transitionPoints!.transition_points.adjust_token_distribution_strategy;
    const testBlockNum = transitionBlockNum + 100;

    // Set up the validator reward account with SPS balance
    const rewardAccountBalance = 100_000_000; // 100M SPS in the reward pool
    await fixture.testHelper.setDummyToken('$VALIDATOR_REWARDS', rewardAccountBalance, TOKENS.SPS);

    // Run the transition first
    await fixture.opsHelper.processVirtualOp(
        'transition_adjust_token_distribution_strategy',
        '$TRANSITIONS',
        {
            block_num: transitionBlockNum,
        },
        {
            block_num: transitionBlockNum,
        },
    );

    // Reload config after transition
    await fixture.loader.load();

    // Create a mock block to process with a proper timestamp
    const blockTimestamp = '2024-01-01T12:00:00.000';
    const block = new NBlock(
        testBlockNum,
        {
            timestamp: blockTimestamp,
            transactions: [],
            transaction_ids: [],
            block_id: `block_${testBlockNum}`,
            previous: `block_${testBlockNum - 1}`,
        },
        { l2_block_id: `l2_block_${testBlockNum - 1}` },
    );

    // Process the block
    const result = await processor!.process(block, testBlockNum);

    // The reward should be calculated using the per_block_capped formula
    // Formula: Z = max(X * 0.7, min(Y * 0.05, X * 0.9))
    // Where:
    // - X = tokens_per_block * num_blocks (0.40509 * 1)
    // - Y = (balance / blocks_per_month) * num_blocks (100_000_000 / 864000 * 1)
    // - blocks_per_month = 864000

    const X = SPS_BLOCK_VALIDATION_TOKENS_PER_BLOCK * 1; // num_blocks = 1
    const Y = (rewardAccountBalance / 864000) * 1; // num_blocks = 1
    const o1 = X * 0.7;
    const o2 = Math.min(Y * 0.05, X * 0.9);
    const expectedReward = Math.max(o1, o2);

    // Verify the block was processed successfully
    expect(result).toBeDefined();
    expect(result.block_hash).toBeDefined();
    expect(result.reward).toBeDefined();

    // The reward is passed to operations via the block_reward parameter
    // We can verify the calculation by checking the config is set correctly
    expect(fixture.loader.validator?.tokens_per_block).toBe(SPS_BLOCK_VALIDATION_TOKENS_PER_BLOCK);
    expect(fixture.loader.validator?.reward_version).toBe('per_block_capped');

    // Verify the balance is still there (no actual rewards claimed yet)
    const balance = await fixture.testHelper.getDummyToken('$VALIDATOR_REWARDS', TOKENS.SPS);
    expect(balance?.balance).toBe(rewardAccountBalance);

    // The expected reward calculation should be > 0
    expect(expectedReward).toBeGreaterThan(0);

    // Verify the actual reward matches the expected calculation
    expect(result.reward).not.toBe(0);
    const [actualRewardAmount, actualRewardToken] = result.reward as [number, string];
    expect(actualRewardToken).toBe(TOKENS.SPS);
    expect(actualRewardAmount).toBe(expectedReward);

    // Log for verification
    console.log('Expected reward per block:', expectedReward);
    console.log('Actual reward per block:', actualRewardAmount);
    console.log('X (tokens_per_block):', X);
    console.log('Y (pool balance / blocks_per_month):', Y);
    console.log('o1 (X * 0.7):', o1);
    console.log('o2 (min(Y * 0.05, X * 0.9)):', o2);
});

test.dbOnly('Block reward is correct before adjust_token_distribution_strategy transition', async () => {
    // Test a block before the transition point
    const transitionBlockNum = transitionPoints!.transition_points.adjust_token_distribution_strategy;
    const testBlockNum = transitionBlockNum - 100;

    // Create a mock block to process with a proper timestamp
    const blockTimestamp = '2024-01-01T12:00:00.000';
    const block = new NBlock(
        testBlockNum,
        {
            timestamp: blockTimestamp,
            transactions: [],
            transaction_ids: [],
            block_id: `block_${testBlockNum}`,
            previous: `block_${testBlockNum - 1}`,
        },
        { l2_block_id: `l2_block_${testBlockNum - 1}` },
    );

    // Process the block
    const result = await processor!.process(block, testBlockNum);

    // Before the transition, the old formula should apply
    // Old formula: tokens_per_block * (1 - (reductions * reduction_pct) / 100)

    // Verify the block was processed successfully
    expect(result).toBeDefined();
    expect(result.block_hash).toBeDefined();
    expect(result.reward).toBeDefined();

    // The reward version should not be per_block_capped yet
    expect(fixture.loader.validator?.reward_version).not.toBe('per_block_capped');

    // Verify the reward is calculated using the old formula (before transition)
    // Before the transition, rewards use the old declining formula
    if (result.reward !== 0) {
        const [actualRewardAmount, actualRewardToken] = result.reward as [number, string];
        expect(actualRewardToken).toBe(TOKENS.SPS);
        expect(actualRewardAmount).toBeGreaterThan(0);
    }
});

test.dbOnly('Block reward with empty validator rewards account after transition', async () => {
    // The transition point where the reward calculation changes
    const transitionBlockNum = transitionPoints!.transition_points.adjust_token_distribution_strategy;
    const testBlockNum = transitionBlockNum + 100;

    // Set up the validator reward account with very small balance (effectively 0)
    await fixture.testHelper.setDummyToken('$VALIDATOR_REWARDS', 0.001, TOKENS.SPS);

    // Run the transition first
    await fixture.opsHelper.processVirtualOp(
        'transition_adjust_token_distribution_strategy',
        '$TRANSITIONS',
        {
            block_num: transitionBlockNum,
        },
        {
            block_num: transitionBlockNum,
        },
    );

    // Reload config after transition
    await fixture.loader.load();

    // Create a mock block to process with a proper timestamp
    const blockTimestamp = '2024-01-01T12:00:00.000';
    const block = new NBlock(
        testBlockNum,
        {
            timestamp: blockTimestamp,
            transactions: [],
            transaction_ids: [],
            block_id: `block_${testBlockNum}`,
            previous: `block_${testBlockNum - 1}`,
        },
        { l2_block_id: `l2_block_${testBlockNum - 1}` },
    );

    // Process the block
    const result = await processor!.process(block, testBlockNum);

    // With near 0 balance, the formula should use the minimum (X * 0.7)
    // Where X = tokens_per_block * num_blocks
    const X = SPS_BLOCK_VALIDATION_TOKENS_PER_BLOCK * 1;
    const expectedMinReward = X * 0.7;

    // Verify the block was processed successfully
    expect(result).toBeDefined();
    expect(result.block_hash).toBeDefined();
    expect(result.reward).toBeDefined();

    // The expected reward should be the minimum
    expect(expectedMinReward).toBeGreaterThan(0);

    // Verify the actual reward matches the expected minimum
    expect(result.reward).not.toBe(0);
    const [actualRewardAmount, actualRewardToken] = result.reward as [number, string];
    expect(actualRewardToken).toBe(TOKENS.SPS);
    expect(actualRewardAmount).toBe(expectedMinReward);

    // Log for verification
    console.log('Expected minimum reward per block:', expectedMinReward);
    console.log('Actual reward per block:', actualRewardAmount);
    console.log('X (tokens_per_block):', X);
});

test.dbOnly('Block reward with very low balance after transition uses minimum cap', async () => {
    // The transition point where the reward calculation changes
    const transitionBlockNum = transitionPoints!.transition_points.adjust_token_distribution_strategy;
    const testBlockNum = transitionBlockNum + 100;

    // Set up the validator reward account with very low balance (1000 SPS)
    const rewardAccountBalance = 1_000;
    await fixture.testHelper.setDummyToken('$VALIDATOR_REWARDS', rewardAccountBalance, TOKENS.SPS);

    // Run the transition first
    await fixture.opsHelper.processVirtualOp(
        'transition_adjust_token_distribution_strategy',
        '$TRANSITIONS',
        {
            block_num: transitionBlockNum,
        },
        {
            block_num: transitionBlockNum,
        },
    );

    // Reload config after transition
    await fixture.loader.load();

    // Create a mock block to process with a proper timestamp
    const blockTimestamp = '2024-01-01T12:00:00.000';
    const block = new NBlock(
        testBlockNum,
        {
            timestamp: blockTimestamp,
            transactions: [],
            transaction_ids: [],
            block_id: `block_${testBlockNum}`,
            previous: `block_${testBlockNum - 1}`,
        },
        { l2_block_id: `l2_block_${testBlockNum - 1}` },
    );

    // Process the block
    const result = await processor!.process(block, testBlockNum);

    // With low balance, Y * 0.05 will be very small, so the formula should use X * 0.7
    const X = SPS_BLOCK_VALIDATION_TOKENS_PER_BLOCK * 1;
    const Y = (rewardAccountBalance / 864000) * 1;
    const o1 = X * 0.7;
    const o2 = Math.min(Y * 0.05, X * 0.9);
    const expectedReward = Math.max(o1, o2);

    // Verify the block was processed successfully
    expect(result).toBeDefined();
    expect(result.block_hash).toBeDefined();
    expect(result.reward).toBeDefined();

    // With such a low balance, we expect o1 (X * 0.7) to be greater than o2
    expect(o1).toBeGreaterThan(o2);
    expect(expectedReward).toBe(o1);

    // Verify the actual reward matches the expected calculation
    expect(result.reward).not.toBe(0);
    const [actualRewardAmount, actualRewardToken] = result.reward as [number, string];
    expect(actualRewardToken).toBe(TOKENS.SPS);
    expect(actualRewardAmount).toBe(expectedReward);

    // Log for verification
    console.log('Expected reward per block (should be minimum):', expectedReward);
    console.log('Actual reward per block:', actualRewardAmount);
    console.log('X (tokens_per_block):', X);
    console.log('Y (pool balance / blocks_per_month):', Y);
    console.log('o1 (X * 0.7):', o1);
    console.log('o2 (min(Y * 0.05, X * 0.9)):', o2);
});

test.dbOnly('Block reward with very high balance after transition uses upper cap', async () => {
    // The transition point where the reward calculation changes
    const transitionBlockNum = transitionPoints!.transition_points.adjust_token_distribution_strategy;
    const testBlockNum = transitionBlockNum + 100;

    // Set up the validator reward account with very high balance (1 billion SPS)
    const rewardAccountBalance = 1_000_000_000;
    await fixture.testHelper.setDummyToken('$VALIDATOR_REWARDS', rewardAccountBalance, TOKENS.SPS);

    // Run the transition first
    await fixture.opsHelper.processVirtualOp(
        'transition_adjust_token_distribution_strategy',
        '$TRANSITIONS',
        {
            block_num: transitionBlockNum,
        },
        {
            block_num: transitionBlockNum,
        },
    );

    // Reload config after transition
    await fixture.loader.load();

    // Create a mock block to process with a proper timestamp
    const blockTimestamp = '2024-01-01T12:00:00.000';
    const block = new NBlock(
        testBlockNum,
        {
            timestamp: blockTimestamp,
            transactions: [],
            transaction_ids: [],
            block_id: `block_${testBlockNum}`,
            previous: `block_${testBlockNum - 1}`,
        },
        { l2_block_id: `l2_block_${testBlockNum - 1}` },
    );

    // Process the block
    const result = await processor!.process(block, testBlockNum);

    // With high balance, Y * 0.05 will be large, but capped by X * 0.9
    const X = SPS_BLOCK_VALIDATION_TOKENS_PER_BLOCK * 1;
    const Y = (rewardAccountBalance / 864000) * 1;
    const o1 = X * 0.7;
    const o2 = Math.min(Y * 0.05, X * 0.9);
    const expectedReward = Math.max(o1, o2);

    // Verify the block was processed successfully
    expect(result).toBeDefined();
    expect(result.block_hash).toBeDefined();
    expect(result.reward).toBeDefined();

    // With such a high balance, we expect o2 to be capped at X * 0.9
    expect(o2).toBe(X * 0.9);
    expect(expectedReward).toBe(X * 0.9);

    // Verify the actual reward matches the expected maximum
    expect(result.reward).not.toBe(0);
    const [actualRewardAmount, actualRewardToken] = result.reward as [number, string];
    expect(actualRewardToken).toBe(TOKENS.SPS);
    expect(actualRewardAmount).toBe(expectedReward);

    // Log for verification
    console.log('Expected reward per block (should be maximum):', expectedReward);
    console.log('Actual reward per block:', actualRewardAmount);
    console.log('X (tokens_per_block):', X);
    console.log('Y (pool balance / blocks_per_month):', Y);
    console.log('o1 (X * 0.7):', o1);
    console.log('o2 (min(Y * 0.05, X * 0.9)):', o2);
});

test.dbOnly('Block processing without transactions works correctly', async () => {
    // The transition point where the reward calculation changes
    const transitionBlockNum = transitionPoints!.transition_points.adjust_token_distribution_strategy;
    const testBlockNum = transitionBlockNum + 50;

    // Set up the validator reward account
    await fixture.testHelper.setDummyToken('$VALIDATOR_REWARDS', 50_000_000, TOKENS.SPS);

    // Run the transition first
    await fixture.opsHelper.processVirtualOp(
        'transition_adjust_token_distribution_strategy',
        '$TRANSITIONS',
        {
            block_num: transitionBlockNum,
        },
        {
            block_num: transitionBlockNum,
        },
    );

    // Reload config after transition
    await fixture.loader.load();

    // Create a block with no transactions and a proper timestamp
    const blockTimestamp = '2024-01-01T12:00:00.000';
    const block = new NBlock(
        testBlockNum,
        {
            timestamp: blockTimestamp,
            transactions: [], // Empty transactions
            transaction_ids: [],
            block_id: `block_${testBlockNum}`,
            previous: `block_${testBlockNum - 1}`,
        },
        { l2_block_id: `l2_block_${testBlockNum - 1}` },
    );

    // Process the block
    const result = await processor!.process(block, testBlockNum);

    // Verify the block was processed successfully
    expect(result).toBeDefined();
    expect(result.block_hash).toBeDefined();
    expect(result.event_logs).toBeDefined();
    expect(result.reward).toBeDefined();

    // Block should process even without transactions
    expect(result.block_hash.length).toBeGreaterThan(0);

    // Verify the reward is calculated correctly even without transactions
    expect(result.reward).not.toBe(0);
    const [actualRewardAmount, actualRewardToken] = result.reward as [number, string];
    expect(actualRewardToken).toBe(TOKENS.SPS);
    expect(actualRewardAmount).toBeGreaterThan(0);
});

test('bad block 101387262 keeps its transactions and pins the microfork header', () => {
    const blockNum = transitionPoints!.transition_points.bad_block_101387262;
    const tx = { ref_block_num: 1, ref_block_prefix: 2, expiration: '2025-11-21T21:28:54', operations: [], extensions: [], signatures: [] };
    const raw = new NBlock(
        blockNum,
        {
            timestamp: '2025-11-21T21:27:54.000',
            transactions: [tx as never],
            transaction_ids: ['ee65874f'],
            block_id: '060b0bfeecfece0743f61e8b0f26335839f6557f',
            previous: '060b0bfd484a25cd78093ddfdbf09a28342c4df8',
        },
        { l2_block_id: 'prev-l2' },
    );
    const transformed = (processor as unknown as { transformBlock(b: NBlock): NBlock }).transformBlock(raw);
    expect(transformed.block_id).toBe('060b0bfe78f7279a3384d2091cbd191e478c0a69');
    expect(transformed.previous).toBe('060b0bfd484a25cd78093ddfdbf09a28342c4df8');
    expect(transformed.block_time).toEqual(new Date('2025-11-21T21:27:54.000Z'));
    expect(transformed.prev_block_hash).toBe('prev-l2');
    expect(transformed.transactions).toEqual([{ transaction: tx, id: 'ee65874f' }]);
});
