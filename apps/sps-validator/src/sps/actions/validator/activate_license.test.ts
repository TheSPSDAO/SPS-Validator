import { emoji_payload, garbage_payload } from '../../../__tests__/db-helpers';
import { container } from '../../../__tests__/test-composition-root';
import { Fixture } from '../../../__tests__/action-fixture';
import { TOKENS } from '../../features/tokens';
import { ConfigEntity } from '@steem-monsters/splinterlands-validator';

const fixture = container.resolve(Fixture);

const validator_rewards_settings = {
    tokens_per_block: 3.90625,
    reduction_blocks: 864000,
    reduction_pct: 1,
    start_block: 67857521,
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
    await fixture.testHelper.setDummyToken('steemmonsters', 0, TOKENS.RUNNING_LICENSE);
    await fixture.loader.load();
});

afterAll(async () => {
    await fixture.dispose();
});

test.dbOnly('Garbage data for activate_license does not crash.', () => {
    return expect(fixture.opsHelper.processOp('activate_license', 'steemmonsters', garbage_payload)).resolves.toBeUndefined();
});

test.dbOnly('Lots of emoji for activate_license does not crash.', () => {
    return expect(fixture.opsHelper.processOp('activate_license', 'steemmonsters', emoji_payload)).resolves.toBeUndefined();
});

test.dbOnly('Activates license and does not sync running licenses without a check in', async () => {
    await fixture.testHelper.setDummyToken('steemmonsters', 100, TOKENS.LICENSE);
    await expect(
        fixture.opsHelper.processOp('activate_license', 'steemmonsters', {
            qty: 10,
        }),
    ).resolves.toBeUndefined();
    const activatedLicenses = await fixture.testHelper.getDummyToken('steemmonsters', TOKENS.ACTIVATED_LICENSE);
    expect(activatedLicenses?.balance).toBe(10);
    const runningLicenses = await fixture.testHelper.getDummyToken('steemmonsters', TOKENS.RUNNING_LICENSE);
    expect(runningLicenses?.balance).toBe(0);
    const licenses = await fixture.testHelper.getDummyToken('steemmonsters', TOKENS.LICENSE);
    expect(licenses?.balance).toBe(90);
});

test.dbOnly('Activates license and does not sync running licenses with an expired check in', async () => {
    const block_num = validator_rewards_settings.start_block + 100_000;
    await fixture.testHelper.insertCheckIn({
        account: 'steemmonsters',
        status: 'active',
        last_check_in_block_num: validator_rewards_settings.start_block,
        last_check_in: new Date(),
    });
    await fixture.testHelper.setDummyToken('steemmonsters', 100, TOKENS.LICENSE);
    await expect(
        fixture.opsHelper.processOp(
            'activate_license',
            'steemmonsters',
            {
                qty: 10,
            },
            { block_num },
        ),
    ).resolves.toBeUndefined();
    const activatedLicenses = await fixture.testHelper.getDummyToken('steemmonsters', TOKENS.ACTIVATED_LICENSE);
    expect(activatedLicenses?.balance).toBe(10);
    const runningLicenses = await fixture.testHelper.getDummyToken('steemmonsters', TOKENS.RUNNING_LICENSE);
    expect(runningLicenses?.balance).toBe(0);
    const licenses = await fixture.testHelper.getDummyToken('steemmonsters', TOKENS.LICENSE);
    expect(licenses?.balance).toBe(90);
});

// the same test as above, but with a different status
test.dbOnly('Activates license and does not sync running licenses with an inactive check in', async () => {
    const block_num = validator_rewards_settings.start_block + 100_000;
    await fixture.testHelper.insertCheckIn({
        account: 'steemmonsters',
        status: 'inactive',
        last_check_in_block_num: validator_rewards_settings.start_block,
        last_check_in: new Date(),
    });
    await fixture.testHelper.setDummyToken('steemmonsters', 100, TOKENS.LICENSE);
    await expect(
        fixture.opsHelper.processOp(
            'activate_license',
            'steemmonsters',
            {
                qty: 10,
            },
            { block_num },
        ),
    ).resolves.toBeUndefined();
    const activatedLicenses = await fixture.testHelper.getDummyToken('steemmonsters', TOKENS.ACTIVATED_LICENSE);
    expect(activatedLicenses?.balance).toBe(10);
    const runningLicenses = await fixture.testHelper.getDummyToken('steemmonsters', TOKENS.RUNNING_LICENSE);
    expect(runningLicenses?.balance).toBe(0);
    const licenses = await fixture.testHelper.getDummyToken('steemmonsters', TOKENS.LICENSE);
    expect(licenses?.balance).toBe(90);
});

test.dbOnly('Activates license and syncs running licenses with a valid check in', async () => {
    const block_num = validator_rewards_settings.start_block + 1;
    await fixture.testHelper.insertCheckIn({ account: 'steemmonsters', status: 'active', last_check_in_block_num: block_num - 1, last_check_in: new Date() });
    await fixture.testHelper.setDummyToken('steemmonsters', 100, TOKENS.LICENSE);
    await expect(
        fixture.opsHelper.processOp(
            'activate_license',
            'steemmonsters',
            {
                qty: 10,
            },
            { block_num },
        ),
    ).resolves.toBeUndefined();
    const activatedLicenses = await fixture.testHelper.getDummyToken('steemmonsters', TOKENS.ACTIVATED_LICENSE);
    expect(activatedLicenses?.balance).toBe(10);
    const runningLicenses = await fixture.testHelper.getDummyToken('steemmonsters', TOKENS.RUNNING_LICENSE);
    expect(runningLicenses?.balance).toBe(10);
    const licenses = await fixture.testHelper.getDummyToken('steemmonsters', TOKENS.LICENSE);
    expect(licenses?.balance).toBe(90);
});

test.dbOnly('Does not activate license qty > balance', async () => {
    await fixture.testHelper.setDummyToken('steemmonsters', 1, TOKENS.LICENSE);
    await expect(
        fixture.opsHelper.processOp('activate_license', 'steemmonsters', {
            qty: 10,
        }),
    ).resolves.toBeUndefined();
    const activatedLicenses = await fixture.testHelper.getDummyToken('steemmonsters', TOKENS.ACTIVATED_LICENSE);
    expect(activatedLicenses?.balance).toBe(0);
    const licenses = await fixture.testHelper.getDummyToken('steemmonsters', TOKENS.LICENSE);
    expect(licenses?.balance).toBe(1);
});
