import { AwardPool, PoolsHelper, ValidatedPool } from './pools';

test('Forbidden name construction should fail', () => {
    expect(() => new PoolsHelper([{ name: '_acc_tokens_per_share', reward_account: '$TOKEN_STAKING_REWARDS', token: 'EUR', stake: 'USD' }])).toThrow();
    expect(() => new PoolsHelper([{ name: '_last_reward_block', reward_account: '$TOKEN_STAKING_REWARDS', token: 'USD', stake: 'USD' }])).toThrow();
});

test('Duplicate name construction should fail', () => {
    expect(
        () =>
            new PoolsHelper([
                { name: 'generic-name', reward_account: '$TOKEN_STAKING_REWARDS', token: 'EUR', stake: 'USD' },
                { name: 'generic-name', reward_account: '$TOKEN_STAKING_REWARDS', token: 'USD', stake: 'USD' },
            ]),
    ).toThrow();
});

test('Duplicate token construction should not fail', () => {
    expect(
        () =>
            new PoolsHelper([
                { name: 'special-name', reward_account: '$TOKEN_STAKING_REWARDS', token: 'EUR', stake: 'USD' },
                { name: 'unique-name', reward_account: '$TOKEN_STAKING_REWARDS', token: 'EUR', stake: 'USD' },
            ]),
    ).not.toThrow();
});

describe('Pool validation tests', () => {
    const x: AwardPool<'x'> = { name: 'x', reward_account: '$TOKEN_STAKING_REWARDS', token: 'xtoken', stake: 'xtoken' };
    const xpool: ValidatedPool<'x'> = {
        x: {
            start_block: 1,
            tokens_per_block: 1,
        },
        x_acc_tokens_per_share: 2e13,
        x_last_reward_block: 1,
    };
    const y: AwardPool<'y'> = { name: 'y', reward_account: '$TOKEN_STAKING_REWARDS', token: 'ytoken', stake: 'ytoken' };
    const ypool: ValidatedPool<'y'> = {
        y: {
            start_block: 1,
            tokens_per_block: 1,
        },
        y_acc_tokens_per_share: 9,
        y_last_reward_block: 3,
    };
    const xypool: ValidatedPool<'x' | 'y'> = {
        ...xpool,
        ...ypool,
    };

    it.each`
        pools     | payload      | isValid
        ${[]}     | ${'apricot'} | ${false}
        ${[x]}    | ${xpool}     | ${true}
        ${[x]}    | ${xypool}    | ${true}
        ${[x]}    | ${ypool}     | ${false}
        ${[x]}    | ${'banana'}  | ${false}
        ${[y]}    | ${xpool}     | ${false}
        ${[y]}    | ${xypool}    | ${true}
        ${[y]}    | ${ypool}     | ${true}
        ${[y]}    | ${'banana'}  | ${false}
        ${[x, y]} | ${xpool}     | ${false}
        ${[x, y]} | ${xypool}    | ${true}
        ${[x, y]} | ${ypool}     | ${false}
        ${[x, y]} | ${'banana'}  | ${false}
    `(`Verifies PoolsHelper with $pools validated to  [$isValid] for [$payload] ($#) `, ({ pools, payload, isValid }) => {
        const p = new PoolsHelper(pools);
        if (isValid) {
            expect(() => p.validate(payload)).not.toThrow();
        } else {
            expect(() => p.validate(payload)).toThrow();
        }
    });

    test('Pool can be retrieved by name or token', () => {
        const p = new PoolsHelper([x, y]);
        expect(p.poolByToken('xtoken')).toBe(x);
        expect(p.poolByToken('ytoken')).toBe(y);
        expect(p.poolByToken('nonetoken')).toBe(undefined);
        expect(p.poolByName('x')).toBe(x);
        expect(p.poolByName('y')).toBe(y);
        expect(p.poolByName('none')).toBe(undefined);
    });

    test('Delegate pool entry should be generated correctly', () => {
        const xdelegate = PoolsHelper.asDelegate(xypool, 'x');
        const ydelegate = PoolsHelper.asDelegate(xypool, 'y');
        expect(xdelegate.last_reward_block).toBe(xypool.x_last_reward_block);
        expect(xdelegate.acc_tokens_per_share).toBe(xypool.x_acc_tokens_per_share);
        expect(ydelegate.last_reward_block).toBe(xypool.y_last_reward_block);
        expect(ydelegate.acc_tokens_per_share).toBe(xypool.y_acc_tokens_per_share);
    });
});
