import { emoji_payload, garbage_payload } from '../../__tests__/db-helpers';
import { Fixture } from '../../__tests__/action-fixture';
import { container } from '../../__tests__/test-composition-root';
import { ConfigEntity } from '@steem-monsters/splinterlands-validator';

const fixture = container.resolve(Fixture);

beforeAll(async () => {
    await fixture.init();
});

beforeEach(async () => {
    await fixture.restore();
    await fixture.testHelper.insertExistingAdmins([]);
    await fixture.handle.query(ConfigEntity).insertItem({
        group_name: '$root',
        group_type: 'object',
        name: 'test',
        index: 0,
        value_type: 'number',
        value: '0',
    });
    await fixture.loader.load();
});

afterAll(async () => {
    await fixture.dispose();
});

test.dbOnly('Garbage data for wrapped operation does not crash.', () => {
    return expect(fixture.opsHelper.processOp(fixture.cfg.custom_json_id, 'steemmonsters', garbage_payload)).resolves.toBeUndefined();
});

test.dbOnly('Lots of emoji for wrapped operation does not crash.', () => {
    return expect(fixture.opsHelper.processOp(fixture.cfg.custom_json_id, 'steemmonsters', emoji_payload)).resolves.toBeUndefined();
});

test.dbOnly('Wrapped single operation should just work', async () => {
    expect(fixture.loader.value['admin_accounts']).toEqual([]);
    await fixture.opsHelper.processOp(fixture.cfg.custom_json_id, 'steemmonsters', {
        action: 'config_update',
        params: {
            updates: [{ group_name: '$root', name: 'admin_accounts', value: JSON.stringify(['wordempire']) }],
        },
    });
    expect(fixture.loader.value['admin_accounts']).toEqual(['wordempire']);
});

test.dbOnly('Wrapped single operation in array should just work', async () => {
    expect(fixture.loader.value['admin_accounts']).toEqual([]);
    await fixture.opsHelper.processOp(fixture.cfg.custom_json_id, 'steemmonsters', [
        {
            action: 'config_update',
            params: {
                updates: [{ group_name: '$root', name: 'admin_accounts', value: JSON.stringify(['wordempire']) }],
            },
        },
    ]);
    expect(fixture.loader.value['admin_accounts']).toEqual(['wordempire']);
});

test.dbOnly('Several operations apply', async () => {
    expect(fixture.loader.value['admin_accounts']).toEqual([]);
    expect(fixture.loader.value['test']).toEqual(0);
    await fixture.opsHelper.processOp(fixture.cfg.custom_json_id, 'steemmonsters', [
        {
            action: 'config_update',
            params: {
                updates: [{ group_name: '$root', name: 'admin_accounts', value: JSON.stringify(['wordempire']) }],
            },
        },
        {
            action: 'config_update',
            params: {
                updates: [{ group_name: '$root', name: 'test', value: '7' }],
            },
        },
    ]);
    expect(fixture.loader.value['admin_accounts']).toEqual(['wordempire']);
    expect(fixture.loader.value['test']).toEqual(7);
});
