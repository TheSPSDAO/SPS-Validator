import { container } from '../../../__tests__/test-composition-root';
import { Fixture } from '../../../__tests__/fixture';
import { BalanceEntity, BalanceHistoryRepository, BalanceRepository, IAction } from '@steem-monsters/splinterlands-validator';

const fixture = container.resolve(Fixture);

beforeAll(async () => {
    await fixture.init();
});

beforeEach(async () => {
    await fixture.restore();
});

afterAll(async () => {
    await fixture.dispose();
});

test.dbOnly('Inserting twice gives error', async () => {
    const player = 'player';
    const token = 'token';
    await expect(fixture.handle.query(BalanceEntity).insertItemWithReturning({ player, token })).resolves.toMatchObject({
        player,
        token,
    });
    await expect(fixture.handle.query(BalanceEntity).insertItemWithReturning({ player, token })).rejects.toBeInstanceOf(Error);
});

test.dbOnly('Inserting double with onConflict and merge prevents error', async () => {
    const player = 'player';
    const token = 'token';

    expect(
        fixture.handle
            .query(BalanceEntity)
            .useKnexQueryBuilder((q) => q.onConflict(['player', 'token']).merge())
            .insertItemWithReturning({ player, token }),
    ).resolves.toMatchObject({ player, token });

    const record = await fixture.handle
        .query(BalanceEntity)
        .useKnexQueryBuilder((q) => q.onConflict(['player', 'token']).merge())
        .insertItemWithReturning({ player, token });
    expect({
        ...record,
        balance: Number(record.balance),
    }).toMatchObject({ player, token, balance: 0 });
});

test.dbOnly('Inserting double with onConflict and merge propagates any existing value', async () => {
    const player = 'player';
    const token = 'token';

    const record = await fixture.handle
        .query(BalanceEntity)
        .useKnexQueryBuilder((q) => q.onConflict(['player', 'token']).merge())
        .insertItemWithReturning({ player, token, balance: '12' });
    expect({
        ...record,
        balance: Number(record.balance),
    }).toMatchObject({ player, token, balance: 12 });

    const record2 = await fixture.handle
        .query(BalanceEntity)
        .useKnexQueryBuilder((q) => q.onConflict(['player', 'token']).merge())
        .insertItemWithReturning({ player, token });
    expect({
        ...record2,
        balance: Number(record2.balance),
    }).toMatchObject({ player, token, balance: 12 });
});

test.dbOnly('Increments balances correctly', async () => {
    const is_bookkeeping_account = jest.fn();
    const repo = new BalanceRepository(fixture.handle, { insert: () => [] } as unknown as BalanceHistoryRepository, {
        is_bookkeeping_account,
    });

    is_bookkeeping_account.mockReturnValue(false);

    await fixture.handle.query(BalanceEntity).insertItems([
        { player: 'player_a', token: 'SPS', balance: '100' },
        { player: 'player_b', token: 'SPS', balance: '100' },
    ]);

    await repo.updateBalance(
        {
            op: {
                block_num: 1,
                trx_op_id: 'lol',
                block_time: new Date(),
            },
        } as any as IAction,
        'player_a',
        'player_b',
        'SPS',
        1,
        null,
    );

    const balance_a = await repo.getBalance('player_a', 'SPS');
    const balance_b = await repo.getBalance('player_b', 'SPS');

    expect(balance_a).toBe(99);
    expect(balance_b).toBe(101);
});

test.dbOnly('Does not go negative on system account that is not a bookkeeping account', async () => {
    const is_bookkeeping_account = jest.fn();
    const repo = new BalanceRepository(fixture.handle, { insert: () => [] } as unknown as BalanceHistoryRepository, {
        is_bookkeeping_account,
    });

    is_bookkeeping_account.mockReturnValue(false);

    await fixture.handle.query(BalanceEntity).insertItems([
        { player: '$REWARDS', token: 'SPS', balance: '0' },
        { player: 'player_b', token: 'SPS', balance: '100' },
    ]);

    const t = async () => {
        await repo.updateBalance(
            {
                op: {
                    block_num: 1,
                    trx_op_id: 'lol',
                    block_time: new Date(),
                },
            } as any as IAction,
            '$REWARDS',
            'player_b',
            'SPS',
            1,
            null,
        );
    };

    await expect(t).rejects.toThrow('Insufficient balance.');

    const balance_a = await repo.getBalance('$REWARDS', 'SPS');
    const balance_b = await repo.getBalance('player_b', 'SPS');

    expect(balance_a).toBe(0);
    expect(balance_b).toBe(100);
});

test.dbOnly('Does go negative on system account that is a bookkeeping account', async () => {
    const is_bookkeeping_account = jest.fn();
    const repo = new BalanceRepository(fixture.handle, { insert: () => [] } as unknown as BalanceHistoryRepository, {
        is_bookkeeping_account,
    });

    is_bookkeeping_account.mockReturnValue(true);

    await fixture.handle.query(BalanceEntity).insertItems([
        { player: '$REWARDS', token: 'SPS', balance: '0' },
        { player: 'player_b', token: 'SPS', balance: '100' },
    ]);

    await repo.updateBalance(
        {
            op: {
                block_num: 1,
                trx_op_id: 'lol',
                block_time: new Date(),
            },
        } as any as IAction,
        '$REWARDS',
        'player_b',
        'SPS',
        1,
        null,
    );

    const balance_a = await repo.getBalance('$REWARDS', 'SPS');
    const balance_b = await repo.getBalance('player_b', 'SPS');

    expect(balance_a).toBe(-1);
    expect(balance_b).toBe(101);
});

test.dbOnly('Does go negative on account that is a bookkeeping account', async () => {
    const is_bookkeeping_account = jest.fn();
    const repo = new BalanceRepository(fixture.handle, { insert: () => [] } as unknown as BalanceHistoryRepository, {
        is_bookkeeping_account,
    });

    is_bookkeeping_account.mockReturnValue(true);

    await fixture.handle.query(BalanceEntity).insertItems([
        { player: 'player_a', token: 'SPS', balance: '0' },
        { player: 'player_b', token: 'SPS', balance: '100' },
    ]);

    await repo.updateBalance(
        {
            op: {
                block_num: 1,
                trx_op_id: 'lol',
                block_time: new Date(),
            },
        } as any as IAction,
        'player_a',
        'player_b',
        'SPS',
        1,
        null,
    );

    const balance_a = await repo.getBalance('player_a', 'SPS');
    const balance_b = await repo.getBalance('player_b', 'SPS');

    expect(balance_a).toBe(-1);
    expect(balance_b).toBe(101);
});
