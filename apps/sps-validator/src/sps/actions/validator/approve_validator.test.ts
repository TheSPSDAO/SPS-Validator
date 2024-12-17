import { emoji_payload, garbage_payload } from '../../../__tests__/db-helpers';
import { container } from '../../../__tests__/test-composition-root';
import { Fixture } from '../../../__tests__/action-fixture';
import { ConfigEntity, ValidatorEntity } from '@steem-monsters/splinterlands-validator';
import { TOKENS } from '../../features/tokens';

const fixture = container.resolve(Fixture);

beforeAll(async () => {
    await fixture.init();
});

beforeEach(async () => {
    await fixture.restore();
    await fixture.testHelper.insertDefaultConfiguration();
    await fixture.handle.query(ConfigEntity).where('group_name', 'validator').andWhere('name', 'max_votes').updateItem({ value: '2' });
    await fixture.testHelper.setDummyToken('steemmonsters', 10, TOKENS.SPSP);
    await fixture.loader.load();
});

afterAll(async () => {
    await fixture.dispose();
});

test.dbOnly('Garbage data for approve_validator does not crash.', () => {
    return expect(fixture.opsHelper.processOp('approve_validator', 'steemmonsters', garbage_payload)).resolves.toBeUndefined();
});

test.dbOnly('Lots of emoji for approve_validator does not crash.', () => {
    return expect(fixture.opsHelper.processOp('approve_validator', 'steemmonsters', emoji_payload)).resolves.toBeUndefined();
});

test.dbOnly('Approve validator', async () => {
    await fixture.testHelper.insertDummyValidator('steemmonsters');
    // TODO: check validator_votes for steemmonsters is empty;
    await expect(
        fixture.opsHelper.processOp('approve_validator', 'steemmonsters', {
            account_name: 'steemmonsters',
        }),
    ).resolves.toBeUndefined();

    const validator = await fixture.handle.query(ValidatorEntity).where('account_name', 'steemmonsters').getSingle();
    expect(validator).toBeTruthy();
    expect(Number(validator.total_votes)).toBe(10);

    const votes = await fixture.testHelper.votesForValidator('steemmonsters');
    expect(votes!.length).toBe(1);
    expect(votes[0]).toMatchObject({
        voter: 'steemmonsters',
        validator: 'steemmonsters',
        vote_weight: '10',
    });
});

test.dbOnly('Nonexisting validator approval', async () => {
    // TODO: check validator_votes for steemmonsters is empty;
    await expect(
        fixture.opsHelper.processOp('approve_validator', 'steemmonsters', {
            account_name: 'steemmonsters',
        }),
    ).resolves.toBeUndefined();
    const votes = await fixture.testHelper.votesForValidator('steemmonsters');
    expect(votes!.length).toBe(0);
});

test.dbOnly('Approve inactive validator', async () => {
    await fixture.testHelper.insertDummyValidator('steemmonsters', false);
    // TODO: check validator_votes for steemmonsters is empty;
    await expect(
        fixture.opsHelper.processOp('approve_validator', 'steemmonsters', {
            account_name: 'steemmonsters',
        }),
    ).resolves.toBeUndefined();
    const votes = await fixture.testHelper.votesForValidator('steemmonsters');
    expect(votes!.length).toBe(0);
});

test.dbOnly('Double vote on validator', async () => {
    await fixture.testHelper.insertDummyValidator('steemmonsters');
    await fixture.testHelper.insertDummyVote('steemmonsters', 'steemmonsters');
    let votes = await fixture.testHelper.votesForValidator('steemmonsters');
    expect(votes!.length).toBe(1);
    // TODO: check validator_votes for steemmonsters has one entry;
    await expect(
        fixture.opsHelper.processOp('approve_validator', 'steemmonsters', {
            account_name: 'steemmonsters',
        }),
    ).resolves.toBeUndefined();
    votes = await fixture.testHelper.votesForValidator('steemmonsters');
    expect(votes!.length).toBe(1);
});

test.dbOnly('Vote when max_votes is exceeded', async () => {
    await fixture.testHelper.insertDummyValidator('steemmonsters');
    await fixture.testHelper.insertDummyVote('steemmonsters', 'steemmonsters1');
    await fixture.testHelper.insertDummyVote('steemmonsters', 'steemmonsters2');
    // TODO: check validator_votes for steemmonsters is empty;
    await expect(
        fixture.opsHelper.processOp('approve_validator', 'steemmonsters', {
            account_name: 'steemmonsters',
        }),
    ).resolves.toBeUndefined();
    const votes = await fixture.testHelper.votesForValidator('steemmonsters');
    expect(votes!.length).toBe(0);
});

test.dbOnly('Approve validator', async () => {
    await fixture.testHelper.insertDummyValidator('steemmonsters');
    // TODO: check validator_votes for steemmonsters is empty;
    await expect(
        fixture.opsHelper.processOp('approve_validator', 'steemmonsters', {
            account_name: 'steemmonsters',
        }),
    ).resolves.toBeUndefined();
    const votes = await fixture.testHelper.votesForValidator('steemmonsters');
    expect(votes!.length).toBe(1);
});

test.dbOnly('Approve validator with posting auth', async () => {
    await fixture.testHelper.insertDummyValidator('steemmonsters');
    // TODO: check validator_votes for steemmonsters is empty;
    await expect(
        fixture.opsHelper.processOp(
            'approve_validator',
            'steemmonsters',
            {
                account_name: 'steemmonsters',
            },
            { is_active: false },
        ),
    ).resolves.toBeUndefined();
    const votes = await fixture.testHelper.votesForValidator('steemmonsters');
    expect(votes!.length).toBe(0);
});
