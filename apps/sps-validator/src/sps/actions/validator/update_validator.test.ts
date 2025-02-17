import { emoji_payload, garbage_payload } from '../../../__tests__/db-helpers';
import { inject, injectable } from 'tsyringe';
import { Fixture as BaseFixture } from '../../../__tests__/action-fixture';
import { container } from '../../../__tests__/test-composition-root';
import { ValidatorRepository } from '@steem-monsters/splinterlands-validator';

@injectable()
class Fixture extends BaseFixture {
    constructor(@inject(ValidatorRepository) readonly Validator: ValidatorRepository) {
        super();
    }
}

const fixture = container.resolve(Fixture);

beforeAll(async () => {
    await fixture.init();
});

beforeEach(async () => {
    await fixture.restore();

    await fixture.testHelper.setHiveAccount('steemmonsters2');
    await fixture.testHelper.setHiveAccount('steemmonsters3');
    await fixture.testHelper.setHiveAccount('steemmonsters4');
    await fixture.testHelper.setHiveAccount('steemmonsters5');
    await fixture.testHelper.setHiveAccount('steemmonsters6');
    await fixture.testHelper.setHiveAccount('steemmonsters7');

    await fixture.testHelper.insertDummyValidator('steemmonsters', true, 100);
    await fixture.testHelper.insertDummyValidator('steemmonsters2', true, 100, 'steemmonsters3');
    await fixture.testHelper.insertDummyValidator('steemmonsters3', true, 100, 'steemmonsters4');

    await fixture.testHelper.insertDummyValidator('steemmonsters5', true, 100);
    await fixture.testHelper.insertDummyValidator('steemmonsters6', true, 100, 'steemmonsters5');

    await fixture.loader.load();
});

afterAll(async () => {
    await fixture.dispose();
});

test.dbOnly('Garbage data for update_validator does not crash.', () => {
    return expect(fixture.opsHelper.processOp('update_validator', 'steemmonsters', garbage_payload)).resolves.toBeUndefined();
});

test.dbOnly('Lots of emoji for update_validator does not crash.', () => {
    return expect(fixture.opsHelper.processOp('update_validator', 'steemmonsters', emoji_payload)).resolves.toBeUndefined();
});

test.dbOnly('Non-boolean is_active does not crash', async () => {
    await fixture.opsHelper.processOp('update_validator', 'steemmonsters7', {
        is_active: 'bagel',
    });
    const validator = await fixture.Validator.lookup('steemmonsters7');
    expect(validator).toBeFalsy();
});

test.dbOnly('Non-string post_url does not crash', async () => {
    await fixture.opsHelper.processOp('update_validator', 'steemmonsters7', {
        is_active: true,
        post_url: 12,
    });
    const validator = await fixture.Validator.lookup('steemmonsters7');
    expect(validator).toBeFalsy();
});

test.dbOnly('Inserting new validator works', async () => {
    await fixture.opsHelper.processOp('update_validator', 'steemmonsters7', {
        is_active: true,
    });
    const {
        validators: [validator],
    } = await fixture.Validator.getValidators();
    expect(validator?.account_name).toBe('steemmonsters');
});

test.dbOnly('Inserting new validator with posting auth does not work', async () => {
    await fixture.opsHelper.processOp(
        'update_validator',
        'steemmonsters7',
        {
            is_active: true,
        },
        { is_active: false },
    );
    const validator = await fixture.Validator.lookup('steemmonsters7');
    expect(validator).toBeFalsy();
});

test.dbOnly('Upserting validator state works', async () => {
    await fixture.opsHelper.processOp(
        'update_validator',
        'steemmonsters',
        {
            is_active: true,
        },
        { transaction: 'insert_update_validator' },
    );
    const {
        validators: [validator],
    } = await fixture.Validator.getValidators();
    expect(validator.is_active).toBe(true);
    await fixture.opsHelper.processOp(
        'update_validator',
        'steemmonsters',
        {
            is_active: false,
        },
        { transaction: 'upsert_update_validator' },
    );
    const {
        validators: [validator2],
    } = await fixture.Validator.getValidators();
    expect(validator2.is_active).toBe(false);
});

test.dbOnly('Setting to inactive takes account out of reward pool', async () => {
    await fixture.testHelper.insertCheckIn({
        account: 'steemmonsters',
        status: 'active',
        last_check_in: new Date(),
        last_check_in_block_num: 1,
    });

    await fixture.opsHelper.processOp('update_validator', 'steemmonsters', {
        is_active: false,
        reward_account: null,
    });

    const checkIn = await fixture.testHelper.getCheckIn('steemmonsters');
    expect(checkIn?.status).toBe('inactive');
});

test.dbOnly('Changing reward account takes old one out of reward pool', async () => {
    await fixture.testHelper.insertCheckIn({
        account: 'steemmonsters4',
        status: 'active',
        last_check_in: new Date(),
        last_check_in_block_num: 1,
    });

    await fixture.opsHelper.processOp('update_validator', 'steemmonsters3', {
        is_active: true,
        reward_account: null,
    });

    const checkIn = await fixture.testHelper.getCheckIn('steemmonsters4');
    expect(checkIn?.status).toBe('inactive');
});

test.dbOnly('Setting node to inactive takes reward account out of reward pool', async () => {
    await fixture.testHelper.insertCheckIn({
        account: 'steemmonsters4',
        status: 'active',
        last_check_in: new Date(),
        last_check_in_block_num: 1,
    });

    await fixture.opsHelper.processOp('update_validator', 'steemmonsters3', {
        is_active: false,
        reward_account: 'steemmonsters4',
    });

    const checkIn = await fixture.testHelper.getCheckIn('steemmonsters4');
    expect(checkIn?.status).toBe('inactive');
});

test.dbOnly('Setting node to inactive does not take it out of the reward pool if covered by another node', async () => {
    await fixture.testHelper.insertCheckIn({
        account: 'steemmonsters5',
        status: 'active',
        last_check_in: new Date(),
        last_check_in_block_num: 1,
    });

    await fixture.opsHelper.processOp('update_validator', 'steemmonsters5', {
        is_active: false,
    });

    const checkIn = await fixture.testHelper.getCheckIn('steemmonsters5');
    expect(checkIn?.status).toBe('active');
});
