import { emoji_payload, garbage_payload } from '../../../__tests__/db-helpers';
import { container } from '../../../__tests__/test-composition-root';
import { Fixture } from '../../../__tests__/action-fixture';
import { TOKENS } from '../../features/tokens';
import { ConfigEntity } from '@steem-monsters/splinterlands-validator';
import { SpsValidatorLicenseManager } from '../../features/validator';

const fixture = container.resolve(Fixture);

const validator_rewards_settings = {
    tokens_per_block: 3.90625,
    reduction_blocks: 864000,
    reduction_pct: 1,
    start_block: 67857521,
    paused_until_block: 67857500,
};

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
        .where('group_name', 'sps')
        .where('name', 'validator_rewards_last_reward_block')
        .updateItem({ value: validator_rewards_settings.start_block.toString() });
    await fixture.handle.query(ConfigEntity).where('group_name', 'sps').where('name', 'validator_rewards_acc_tokens_per_share').updateItem({ value: '0'.toString() });
    await fixture.loader.load();
});

afterAll(async () => {
    await fixture.dispose();
});

test.dbOnly('Garbage data for expire_check_ins does not crash.', () => {
    return expect(fixture.opsHelper.processVirtualOp('expire_check_ins', SpsValidatorLicenseManager.LICENSE_MANAGER_ACCOUNT, garbage_payload)).resolves.toBeUndefined();
});

test.dbOnly('Lots of emoji for expire_check_ins does not crash.', () => {
    return expect(fixture.opsHelper.processVirtualOp('expire_check_ins', SpsValidatorLicenseManager.LICENSE_MANAGER_ACCOUNT, emoji_payload)).resolves.toBeUndefined();
});

test.dbOnly('expire_check_ins expires check ins and takes them out of the reward pool', async () => {
    const last_check_in_block_num = validator_rewards_settings.start_block + 1;
    const block_num = last_check_in_block_num + fixture.loader.validator_check_in!.check_in_interval_blocks + fixture.loader.validator_check_in!.check_in_window_blocks + 1;
    await fixture.testHelper.setDummyToken('steemmonsters', 1, TOKENS.ACTIVATED_LICENSE);
    await fixture.testHelper.setDummyToken('steemmonsters', 1, TOKENS.RUNNING_LICENSE);
    await fixture.testHelper.setDummyToken(fixture.cfg.staking_account, -1, TOKENS.RUNNING_LICENSE);
    await fixture.testHelper.insertCheckIn({ account: 'steemmonsters', status: 'active', last_check_in_block_num, last_check_in: new Date() });

    await expect(fixture.opsHelper.processVirtualOp('expire_check_ins', SpsValidatorLicenseManager.LICENSE_MANAGER_ACCOUNT, {}, { block_num })).resolves.toBeUndefined();

    // should have a valid check in
    const checkIn = await fixture.testHelper.getCheckIn('steemmonsters');
    expect(checkIn).toBeTruthy();
    expect(checkIn?.last_check_in_block_num).toBe(last_check_in_block_num);
    expect(checkIn?.status).toBe('inactive');

    // should not be in the validator reward pool anymore
    const runningLicenses = await fixture.testHelper.getDummyToken('steemmonsters', TOKENS.RUNNING_LICENSE);
    expect(runningLicenses?.balance).toBe(0);

    // should have a reward
    const rewards = await fixture.testHelper.getDummyToken('steemmonsters', TOKENS.SPS);
    expect(rewards?.balance).toBeCloseTo(validator_rewards_settings.tokens_per_block * (block_num - validator_rewards_settings.start_block));
});
