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
    await fixture.opsHelper.processOp('update_validator', 'steemmonsters', {
        is_active: 'bagel',
    });
    const { validators } = await fixture.Validator.getValidators();
    expect(validators?.length).toBe(0);
});

test.dbOnly('Non-string post_url does not crash', async () => {
    await fixture.opsHelper.processOp('update_validator', 'steemmonsters', {
        is_active: true,
        post_url: 12,
    });
    const { validators } = await fixture.Validator.getValidators();
    expect(validators?.length).toBe(0);
});

test.dbOnly('Inserting new validator works', async () => {
    await fixture.opsHelper.processOp('update_validator', 'steemmonsters', {
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
        'steemmonsters',
        {
            is_active: true,
        },
        { is_active: false },
    );
    const { validators } = await fixture.Validator.getValidators();
    expect(validators?.length).toBe(0);
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
