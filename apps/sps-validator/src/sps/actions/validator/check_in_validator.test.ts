import { emoji_payload, garbage_payload } from '../../../__tests__/db-helpers';
import { container } from '../../../__tests__/test-composition-root';
import { Fixture } from '../../../__tests__/action-fixture';
import { TOKENS } from '../../features/tokens';
import { ConfigEntity } from '@steem-monsters/splinterlands-validator';
import { sha256 } from 'js-sha256';

const fixture = container.resolve(Fixture);

const validator_rewards_settings = {
    tokens_per_block: 3.90625,
    reduction_blocks: 864000,
    reduction_pct: 1,
    start_block: 67857521,
};

const rewards_paused_until_block = 67857530;

beforeAll(async () => {
    await fixture.init();
});

beforeEach(async () => {
    await fixture.restore();
    await fixture.testHelper.insertDefaultConfiguration();

    await fixture.handle
        .query(ConfigEntity)
        .where('group_name', 'sps')
        .where('name', 'validator_rewards')
        .updateItem({ value: JSON.stringify(validator_rewards_settings) });

    await fixture.handle
        .query(ConfigEntity)
        .where('group_name', 'validator_check_in')
        .where('name', 'paused_until_block')
        .updateItem({ value: rewards_paused_until_block.toString() });

    await fixture.testHelper.setHiveAccount('steemmonsters');
    await fixture.testHelper.setHiveAccount('steemmonsters2');
    await fixture.testHelper.setHiveAccount('steemmonsters3');
    await fixture.testHelper.setHiveAccount('steemmonsters4');

    await fixture.testHelper.insertDummyValidator('steemmonsters', true, 100);
    await fixture.testHelper.insertDummyValidator('steemmonsters2', true, 100);
    await fixture.testHelper.insertDummyValidator('steemmonsters3', true, 100, 'steemmonsters2');

    await fixture.loader.load();
});

afterAll(async () => {
    await fixture.dispose();
});

test.dbOnly('Garbage data for check_in_validator does not crash.', () => {
    return expect(fixture.opsHelper.processOp('deactivate_license', 'steemmonsters', garbage_payload)).resolves.toBeUndefined();
});

test.dbOnly('Lots of emoji for check_in_validator does not crash.', () => {
    return expect(fixture.opsHelper.processOp('deactivate_license', 'steemmonsters', emoji_payload)).resolves.toBeUndefined();
});

test.dbOnly('check_in_validator succeeds', async () => {
    const block_num = rewards_paused_until_block + 1;
    const block_hash = 'abc';
    const check_in_hash = sha256(`${block_hash}steemmonsters`);
    await fixture.testHelper.insertDummyBlock(block_num - 1, block_hash, 'steemmonsters');
    await fixture.testHelper.setDummyToken('steemmonsters', 1, TOKENS.ACTIVATED_LICENSE);
    await expect(
        fixture.opsHelper.processOp(
            'check_in_validator',
            'steemmonsters',
            {
                block_num: block_num - 1,
                hash: check_in_hash,
            },
            { block_num },
        ),
    ).resolves.toBeUndefined();

    // should have a valid check in
    const checkIn = await fixture.testHelper.getCheckIn('steemmonsters');
    expect(checkIn).toBeTruthy();
    expect(checkIn?.last_check_in_block_num).toBe(block_num);
    expect(checkIn?.status).toBe('active');

    // should be in the validator reward pool
    const runningLicenses = await fixture.testHelper.getDummyToken('steemmonsters', TOKENS.RUNNING_LICENSE);
    expect(runningLicenses?.balance).toBe(1);
});

test.dbOnly('check_in_validator fails for non-validator', async () => {
    const block_num = rewards_paused_until_block + 1;
    const block_hash = 'abc';
    const check_in_hash = sha256(`${block_hash}steemmonsters4`);
    await fixture.testHelper.insertDummyBlock(block_num - 1, block_hash, 'steemmonsters');
    await fixture.testHelper.setDummyToken('steemmonsters4', 1, TOKENS.ACTIVATED_LICENSE);
    await expect(
        fixture.opsHelper.processOp(
            'check_in_validator',
            'steemmonsters4',
            {
                block_num: block_num - 1,
                hash: check_in_hash,
            },
            { block_num },
        ),
    ).resolves.toBeUndefined();

    // should have a valid check in
    const checkIn = await fixture.testHelper.getCheckIn('steemmonsters4');
    expect(checkIn).toBeFalsy();

    // shouldnt be in the validator reward pool
    const runningLicenses = await fixture.testHelper.getDummyToken('steemmonsters4', TOKENS.RUNNING_LICENSE);
    expect(runningLicenses?.balance ?? 0).toBe(0);
});

test.dbOnly('check_in_validator for reward_account succeeds', async () => {
    const block_num = rewards_paused_until_block + 1;
    const block_hash = 'abc';
    const check_in_hash = sha256(`${block_hash}steemmonsters2`);
    await fixture.testHelper.insertDummyBlock(block_num - 1, block_hash, 'steemmonsters');
    await fixture.testHelper.setDummyToken('steemmonsters2', 1, TOKENS.ACTIVATED_LICENSE);
    await expect(
        fixture.opsHelper.processOp(
            'check_in_validator',
            'steemmonsters3',
            {
                block_num: block_num - 1,
                hash: check_in_hash,
            },
            { block_num },
        ),
    ).resolves.toBeUndefined();

    // should have a valid check in
    const checkIn = await fixture.testHelper.getCheckIn('steemmonsters2');
    expect(checkIn).toBeTruthy();
    expect(checkIn?.last_check_in_block_num).toBe(block_num);
    expect(checkIn?.status).toBe('active');

    // should be in the validator reward pool
    const runningLicenses = await fixture.testHelper.getDummyToken('steemmonsters2', TOKENS.RUNNING_LICENSE);
    expect(runningLicenses?.balance).toBe(1);
});

test.dbOnly('check_in_validator for reward_account with no licenses fails', async () => {
    const block_num = rewards_paused_until_block + 1;
    const block_hash = 'abc';
    const check_in_hash = sha256(`${block_hash}steemmonsters2`);
    await fixture.testHelper.insertDummyBlock(block_num - 1, block_hash, 'steemmonsters');
    await fixture.testHelper.setDummyToken('steemmonsters2', 0, TOKENS.ACTIVATED_LICENSE);
    await expect(
        fixture.opsHelper.processOp(
            'check_in_validator',
            'steemmonsters3',
            {
                block_num: block_num - 1,
                hash: check_in_hash,
            },
            { block_num },
        ),
    ).resolves.toBeUndefined();

    // should have a valid check in
    const checkIn = await fixture.testHelper.getCheckIn('steemmonsters2');
    expect(checkIn).toBeFalsy();

    // should be in the validator reward pool
    const runningLicenses = await fixture.testHelper.getDummyToken('steemmonsters2', TOKENS.RUNNING_LICENSE);
    expect(runningLicenses?.balance ?? 0).toBe(0);
});

test.dbOnly('check_in_validator fails without a license', async () => {
    const block_num = rewards_paused_until_block + 1;
    const block_hash = 'abc';
    const check_in_hash = sha256(`${block_hash}steemmonsters`);
    await fixture.testHelper.insertDummyBlock(block_num - 1, block_hash, 'steemmonsters');
    await fixture.testHelper.setDummyToken('steemmonsters', 0, TOKENS.ACTIVATED_LICENSE);
    await expect(
        fixture.opsHelper.processOp(
            'check_in_validator',
            'steemmonsters',
            {
                block_num: block_num - 1,
                hash: check_in_hash,
            },
            { block_num },
        ),
    ).resolves.toBeUndefined();

    // should have a valid check in
    const checkIn = await fixture.testHelper.getCheckIn('steemmonsters');
    expect(checkIn).toBeFalsy();

    // should be in the validator reward pool
    const runningLicenses = await fixture.testHelper.getDummyToken('steemmonsters', TOKENS.RUNNING_LICENSE);
    expect(runningLicenses?.balance ?? 0).toBe(0);
});

test.dbOnly('check_in_validator fails with invalid check in hash', async () => {
    const block_num = rewards_paused_until_block + 1;
    const block_hash = 'abc';
    const check_in_hash = sha256(`${block_hash}abc123244`);
    await fixture.testHelper.insertDummyBlock(block_num - 1, block_hash, 'steemmonsters');
    await fixture.testHelper.setDummyToken('steemmonsters', 1, TOKENS.ACTIVATED_LICENSE);
    await expect(
        fixture.opsHelper.processOp(
            'check_in_validator',
            'steemmonsters',
            {
                block_num: block_num - 1,
                hash: check_in_hash,
            },
            { block_num },
        ),
    ).resolves.toBeUndefined();

    const checkIn = await fixture.testHelper.getCheckIn('steemmonsters');
    expect(checkIn).toBeFalsy();

    const runningLicenses = await fixture.testHelper.getDummyToken('steemmonsters', TOKENS.RUNNING_LICENSE);
    expect(runningLicenses?.balance ?? 0).toBe(0);
});

test.dbOnly('check_in_validator fails when reward pool is paused', async () => {
    const block_num = rewards_paused_until_block - 1;
    const block_hash = 'abc';
    const check_in_hash = sha256(`${block_hash}steemmonsters`);
    await fixture.testHelper.insertDummyBlock(block_num - 1, block_hash, 'steemmonsters');
    await fixture.testHelper.setDummyToken('steemmonsters', 1, TOKENS.ACTIVATED_LICENSE);

    await expect(
        fixture.opsHelper.processOp(
            'check_in_validator',
            'steemmonsters',
            {
                block_num: block_num - 1,
                hash: check_in_hash,
            },
            { block_num },
        ),
    ).resolves.toBeUndefined();

    // should not have a valid check in
    const checkIn = await fixture.testHelper.getCheckIn('steemmonsters');
    expect(checkIn).toBeFalsy();

    // should be in the validator reward pool
    const runningLicenses = await fixture.testHelper.getDummyToken('steemmonsters', TOKENS.RUNNING_LICENSE);
    expect(runningLicenses?.balance ?? 0).toBe(0);
});

test.dbOnly('check_in_validator fails when checking in too soon', async () => {
    const block_num = rewards_paused_until_block + 1;
    const block_hash = 'abc';
    const check_in_hash = sha256(`${block_hash}steemmonsters`);
    await fixture.testHelper.insertDummyBlock(block_num - 1, block_hash, 'steemmonsters');
    await fixture.testHelper.setDummyToken('steemmonsters', 1, TOKENS.ACTIVATED_LICENSE);

    await expect(
        fixture.opsHelper.processOp(
            'check_in_validator',
            'steemmonsters',
            {
                block_num: block_num - 1,
                hash: check_in_hash,
            },
            { block_num },
        ),
    ).resolves.toBeUndefined();

    const next_block_num = block_num + 1;
    const next_block_hash = 'abc2';
    const next_check_in_hash = sha256(`${next_block_hash}steemmonsters`);
    await fixture.testHelper.insertDummyBlock(next_block_num - 1, next_block_hash, 'steemmonsters');
    await expect(
        fixture.opsHelper.processOp(
            'check_in_validator',
            'steemmonsters',
            {
                hash: next_check_in_hash,
                block_num: next_block_num - 1,
            },
            { block_num: next_block_num },
        ),
    ).resolves.toBeUndefined();

    // should have a valid check in
    const checkIn = await fixture.testHelper.getCheckIn('steemmonsters');
    expect(checkIn).toBeTruthy();
    expect(checkIn?.last_check_in_block_num).toBe(block_num);

    // should be in the validator reward pool
    const runningLicenses = await fixture.testHelper.getDummyToken('steemmonsters', TOKENS.RUNNING_LICENSE);
    expect(runningLicenses?.balance ?? 0).toBe(1);
});

test.dbOnly('check_in_validator succeeds twice without adding to the reward pool twice', async () => {
    const block_num = rewards_paused_until_block + 1;
    const block_hash = 'abc';
    const check_in_hash = sha256(`${block_hash}steemmonsters`);
    await fixture.testHelper.insertDummyBlock(block_num - 1, block_hash, 'steemmonsters');
    await fixture.testHelper.setDummyToken('steemmonsters', 1, TOKENS.ACTIVATED_LICENSE);

    await expect(
        fixture.opsHelper.processOp(
            'check_in_validator',
            'steemmonsters',
            {
                block_num: block_num - 1,
                hash: check_in_hash,
            },
            { block_num },
        ),
    ).resolves.toBeUndefined();

    const next_block_num = block_num + fixture.loader.validator_check_in!.check_in_interval_blocks + fixture.loader.validator_check_in!.check_in_window_blocks + 1;
    const next_block_hash = 'abc2';
    const next_check_in_hash = sha256(`${next_block_hash}steemmonsters`);
    await fixture.testHelper.insertDummyBlock(next_block_num - 1, next_block_hash, 'steemmonsters');
    await expect(
        fixture.opsHelper.processOp(
            'check_in_validator',
            'steemmonsters',
            {
                block_num: next_block_num - 1,
                hash: next_check_in_hash,
            },
            { block_num: next_block_num },
        ),
    ).resolves.toBeUndefined();

    // should have a valid check in
    const checkIn = await fixture.testHelper.getCheckIn('steemmonsters');
    expect(checkIn).toBeTruthy();
    expect(checkIn?.last_check_in_block_num).toBe(next_block_num);

    // should be in the validator reward pool once still
    const runningLicenses = await fixture.testHelper.getDummyToken('steemmonsters', TOKENS.RUNNING_LICENSE);
    expect(runningLicenses?.balance ?? 0).toBe(1);
});
