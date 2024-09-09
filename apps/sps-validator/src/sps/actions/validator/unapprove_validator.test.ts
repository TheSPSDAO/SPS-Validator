import { emoji_payload, garbage_payload } from '../../../__tests__/db-helpers';
import { Fixture } from '../../../__tests__/action-fixture';
import { container } from '../../../__tests__/test-composition-root';
import { ConfigEntity } from '@steem-monsters/splinterlands-validator';

const fixture = container.resolve(Fixture);

beforeAll(async () => {
    await fixture.init();
});

beforeEach(async () => {
    await fixture.restore();

    await fixture.handle.query(ConfigEntity).insertItem({
        group_name: 'validator',
        group_type: 'object',
        name: 'max_votes',
        index: 0,
        value_type: 'number',
        value: '2',
    });
    await fixture.loader.load();
});

afterAll(async () => {
    await fixture.dispose();
});

test.dbOnly('Garbage data for unapprove_validator does not crash.', () => {
    return expect(fixture.opsHelper.processOp('unapprove_validator', 'steemmonsters', garbage_payload)).resolves.toBeUndefined();
});

test.dbOnly('Lots of emoji for unapprove_validator does not crash.', () => {
    return expect(fixture.opsHelper.processOp('unapprove_validator', 'steemmonsters', emoji_payload)).resolves.toBeUndefined();
});

test.dbOnly('Nonexisting validator unapproval', async () => {
    let votes = await fixture.testHelper.votesForValidator('steemmonsters');
    expect(votes!.length).toBe(0);
    await expect(
        fixture.opsHelper.processOp('unapprove_validator', 'steemmonsters', {
            account_name: 'steemmonsters',
        }),
    ).resolves.toBeUndefined();
    votes = await fixture.testHelper.votesForValidator('steemmonsters');
    expect(votes!.length).toBe(0);
});

test.dbOnly('Unapprove inactive validator with votes', async () => {
    await fixture.testHelper.insertDummyValidator('steemmonsters', false);
    await fixture.testHelper.insertDummyVote('steemmonsters', 'steemmonsters');
    let votes = await fixture.testHelper.votesForValidator('steemmonsters');
    expect(votes!.length).toBe(1);
    await expect(
        fixture.opsHelper.processOp('unapprove_validator', 'steemmonsters', {
            account_name: 'steemmonsters',
        }),
    ).resolves.toBeUndefined();
    votes = await fixture.testHelper.votesForValidator('steemmonsters');
    expect(votes!.length).toBe(0);
});

test.dbOnly('Remove vote for validator', async () => {
    await fixture.testHelper.insertDummyValidator('steemmonsters');
    await fixture.testHelper.insertDummyVote('steemmonsters', 'steemmonsters');
    let votes = await fixture.testHelper.votesForValidator('steemmonsters');
    expect(votes!.length).toBe(1);
    await expect(
        fixture.opsHelper.processOp('unapprove_validator', 'steemmonsters', {
            account_name: 'steemmonsters',
        }),
    ).resolves.toBeUndefined();
    votes = await fixture.testHelper.votesForValidator('steemmonsters');
    expect(votes!.length).toBe(0);
});

test.dbOnly('Unapprove validator with posting auth', async () => {
    await fixture.testHelper.insertDummyValidator('steemmonsters');
    await fixture.testHelper.insertDummyVote('steemmonsters', 'steemmonsters');
    let votes = await fixture.testHelper.votesForValidator('steemmonsters');
    expect(votes!.length).toBe(1);
    await expect(
        fixture.opsHelper.processOp(
            'unapprove_validator',
            'steemmonsters',
            {
                account_name: 'steemmonsters',
            },
            { is_active: false },
        ),
    ).resolves.toBeUndefined();
    votes = await fixture.testHelper.votesForValidator('steemmonsters');
    expect(votes!.length).toBe(1);
});
