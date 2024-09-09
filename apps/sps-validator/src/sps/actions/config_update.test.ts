import { emoji_payload, garbage_payload } from '../../__tests__/db-helpers';
import { container } from '../../__tests__/test-composition-root';
import { Fixture } from '../../__tests__/action-fixture';

const fixture = container.resolve(Fixture);

beforeAll(async () => {
    await fixture.init();
});

beforeEach(async () => {
    await fixture.restore();
    await fixture.testHelper.insertExistingAdmins([]);
    await fixture.loader.load();
});

afterAll(async () => {
    await fixture.dispose();
});

test.dbOnly('Garbage data for config_update does not crash.', () => {
    return expect(fixture.opsHelper.processOp('config_update', 'steemmonsters', garbage_payload)).resolves.toBeUndefined();
});

test.dbOnly('Lots of emoji for config_update does not crash.', () => {
    return expect(fixture.opsHelper.processOp('config_update', 'steemmonsters', emoji_payload)).resolves.toBeUndefined();
});

test.dbOnly('Nonadmin tries to affect config_update', async () => {
    expect(fixture.loader.value['admin_accounts']).toEqual([]);
    await fixture.opsHelper.processOp('config_update', 'wordempire', {
        updates: [{ group_name: '$root', name: 'admin_accounts', value: JSON.stringify(['wordempire']) }],
    });
    expect(fixture.loader.value['admin_accounts']).toEqual([]);
});

test.dbOnly('Admin updates existing config', async () => {
    expect(fixture.loader.value['admin_accounts']).toEqual([]);
    await fixture.opsHelper.processOp('config_update', 'steemmonsters', {
        updates: [{ group_name: '$root', name: 'admin_accounts', value: JSON.stringify(['wordempire']) }],
    });
    expect(fixture.loader.value['admin_accounts']).toEqual(['wordempire']);
});

test.dbOnly('Admin attempts to update existing config with posting auth', async () => {
    expect(fixture.loader.value['admin_accounts']).toEqual([]);
    await fixture.opsHelper.processOp(
        'config_update',
        'steemmonsters',
        {
            updates: [{ group_name: '$root', name: 'admin_accounts', value: JSON.stringify(['wordempire']) }],
        },
        { is_active: false },
    );
    expect(fixture.loader.value['admin_accounts']).toEqual([]);
});

test.dbOnly('Admin attempts to update nonexistent config', async () => {
    await expect(
        fixture.opsHelper.processOp('config_update', 'steemmonsters', {
            updates: [
                {
                    group_name: 'nox-root',
                    name: 'not_admin_accounts',
                    value: JSON.stringify(['wordempire', 'worthempire']),
                },
            ],
        }),
    ).rejects.toBeInstanceOf(Error);
    const perhaps = fixture.loader.value as any;
    expect(perhaps?.['nox-root']?.['not_admin_accounts']).toBeUndefined();
});
