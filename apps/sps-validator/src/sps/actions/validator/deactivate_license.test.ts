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
    await fixture.loader.load();
});

afterAll(async () => {
    await fixture.dispose();
});

test.dbOnly('Garbage data for deactivate_license does not crash.', () => {
    return expect(fixture.opsHelper.processOp('deactivate_license', 'steemmonsters', garbage_payload)).resolves.toBeUndefined();
});

test.dbOnly('Lots of emoji for deactivate_license does not crash.', () => {
    return expect(fixture.opsHelper.processOp('deactivate_license', 'steemmonsters', emoji_payload)).resolves.toBeUndefined();
});

test.dbOnly('Deactivates licenses', async () => {
    await fixture.testHelper.setDummyToken('steemmonsters', 100, TOKENS.ACTIVATED_LICENSE);
    await expect(
        fixture.opsHelper.processOp('deactivate_license', 'steemmonsters', {
            qty: 10,
        }),
    ).resolves.toBeUndefined();
    const activatedLicenses = await fixture.testHelper.getDummyToken('steemmonsters', TOKENS.LICENSE);
    expect(activatedLicenses?.balance).toBe(10);
    const licenses = await fixture.testHelper.getDummyToken('steemmonsters', TOKENS.ACTIVATED_LICENSE);
    expect(licenses?.balance).toBe(90);
});

test.dbOnly('Deactivates license and syncs running licenses with a valid check in', async () => {
    const block_num = validator_rewards_settings.start_block + 1;
    await fixture.testHelper.insertCheckIn({
        account: 'steemmonsters',
        status: 'active',
        last_check_in_block_num: validator_rewards_settings.start_block,
        last_check_in: new Date(),
    });
    await fixture.testHelper.setDummyToken('steemmonsters', 100, TOKENS.ACTIVATED_LICENSE);
    await fixture.testHelper.setDummyToken('steemmonsters', 100, TOKENS.RUNNING_LICENSE);
    await expect(
        fixture.opsHelper.processOp(
            'deactivate_license',
            'steemmonsters',
            {
                qty: 10,
            },
            { block_num },
        ),
    ).resolves.toBeUndefined();
    const activatedLicenses = await fixture.testHelper.getDummyToken('steemmonsters', TOKENS.LICENSE);
    expect(activatedLicenses?.balance).toBe(10);
    const runningLicenses = await fixture.testHelper.getDummyToken('steemmonsters', TOKENS.RUNNING_LICENSE);
    expect(runningLicenses?.balance).toBe(90);
    const licenses = await fixture.testHelper.getDummyToken('steemmonsters', TOKENS.LICENSE);
    expect(licenses?.balance).toBe(10);
});

test.dbOnly('Does not deactivate license qty > balance', async () => {
    await fixture.testHelper.setDummyToken('steemmonsters', 1, TOKENS.ACTIVATED_LICENSE);
    await expect(
        fixture.opsHelper.processOp('deactivate_license', 'steemmonsters', {
            qty: 10,
        }),
    ).resolves.toBeUndefined();
    const activatedLicenses = await fixture.testHelper.getDummyToken('steemmonsters', TOKENS.LICENSE);
    expect(activatedLicenses?.balance).toBe(0);
    const licenses = await fixture.testHelper.getDummyToken('steemmonsters', TOKENS.ACTIVATED_LICENSE);
    expect(licenses?.balance).toBe(1);
});
