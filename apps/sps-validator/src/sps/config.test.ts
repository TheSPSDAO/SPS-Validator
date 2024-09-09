import { SpsConfigLoader } from './config';
import { Fixture } from '../__tests__/action-fixture';
import { container } from '../__tests__/test-composition-root';
import { ConfigEntity } from '@steem-monsters/splinterlands-validator';

const fixture = container.resolve(Fixture);

beforeAll(async () => {
    await fixture.init();
});

beforeEach(async () => {
    await fixture.restore();
    await fixture.testHelper.insertExistingAdmins(['tehbone']);
    await fixture.handle.query(ConfigEntity).insertItem({
        group_name: 'anygroup',
        group_type: 'object',
        name: 'testvalue',
        index: 0,
        value_type: 'string',
        value: 'initialvalue',
    });
    await fixture.loader.clear();
    await fixture.loader.load();
});

afterAll(async () => {
    await fixture.dispose();
});

test.dbOnly('Update db and update cache', async () => {
    const data = { group_name: '$root', name: 'admin_accounts', value: JSON.stringify(['tehbone']) };
    await fixture.loader.updateConfig(data.group_name, data.name, data.value);
    expect(fixture.loader.value[data.name]).toBe(data.value);
});

test.dbOnly('Update config cache only under same group_name', () => {
    const data = { group_name: '$root', name: 'admin_accounts', value: JSON.stringify(['tehbone']) };
    fixture.loader.update(data);
    expect(fixture.loader.value[data.name]).toBe(data.value);
    const other_data = { group_name: '$root', name: 'other_accounts', value: JSON.stringify(['tehbone']) };
    fixture.loader.update(other_data);
    expect(fixture.loader.value[data.name]).toBe(data.value);
    expect(fixture.loader.value[other_data.name]).toBe(other_data.value);
});

test.dbOnly('Regression: immutable config updates in group does not overwrite existing config copies', () => {
    const data = { group_name: 'anygroup', name: 'testvalue', value: 'myfirstsetter' };
    fixture.loader.update(data);
    const beforeData = fixture.loader.value as any;
    expect(beforeData[data.group_name][data.name]).toBe(data.value);
    const other_data = { group_name: 'anygroup', name: 'testvalue', value: 'mysecondsetter' };
    fixture.loader.update(other_data);
    const afterData = fixture.loader.value as any;
    expect(beforeData[data.group_name][data.name]).toBe(data.value);
    expect(afterData[other_data.group_name][other_data.name]).toBe(other_data.value);
});

test.dbOnly('Regression: immutable config updates in root does not overwrite existing config copies', () => {
    const data = { group_name: '$root', name: 'testvalue', value: 'myfirstsetter' };
    fixture.loader.update(data);
    const beforeData = fixture.loader.value as any;
    expect(beforeData[data.name]).toBe(data.value);
    const other_data = { group_name: '$root', name: 'testvalue', value: 'mysecondsetter' };
    fixture.loader.update(other_data);
    const afterData = fixture.loader.value as any;
    expect(beforeData[data.name]).toBe(data.value);
    expect(afterData[other_data.name]).toBe(other_data.value);
});

test.dbOnly('Reload config cache only', () => {
    fixture.loader.reload({ validator: { ...SpsConfigLoader.DEFAULT.validator, reward_start_block: 60963785, num_top_validators: 10 } });
    expect(fixture.loader.validator?.reward_start_block).toBe(60963785);
    fixture.loader.reload({
        validator: { ...SpsConfigLoader.DEFAULT.validator, reward_start_block: 60963785, num_top_validators: 10 },
        sps: { ...SpsConfigLoader.DEFAULT.sps, unstaking_interval_seconds: 1 },
    });
    expect(fixture.loader.validator?.reward_start_block).toBe(60963785);
    expect(fixture.loader.pools?.unstaking_interval_seconds).toBe(1);
});

test.dbOnly('Config size', () => {
    expect(fixture.loader.size).toBeUndefined();
});

test.dbOnly('Config can update always true', () => {
    expect(fixture.loader.canUpdate).toBe(true);
});
