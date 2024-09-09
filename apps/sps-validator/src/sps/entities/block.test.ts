import { container } from '../../__tests__/test-composition-root';
import { Disposable } from '../../__tests__/disposable';
import { BlockRepository, Handle, TransactionRepository } from '@steem-monsters/splinterlands-validator';
import { Backup } from '../../__tests__/fake-db';

describe('Block Repository', () => {
    const db = container.resolve<Backup>(Backup);
    let elementUnderTest: BlockRepository;

    beforeAll(async () => {
        await db.init();
    });

    beforeEach(async () => {
        await db.restore();
        const handle: Handle = container.resolve(Handle);
        const transactionRepository = new TransactionRepository(handle, { send: jest.fn(), perhapsConnect: jest.fn() });
        elementUnderTest = new BlockRepository(handle, transactionRepository);
    });

    afterAll(async () => {
        const disposables: Disposable[] = container.resolveAll(Disposable);
        for (const disposable of disposables) {
            await disposable.dispose();
        }
    });

    test.dbOnly('Creates unique EventLogs for insert validation', async () => {
        await elementUnderTest.insertProcessed(
            {
                block_num: 1,
                block_id: 'a',
                block_time: new Date(),
                prev_block_hash: '',
                previous: '',
                transactions: [],
            },
            [],
            null,
        );
        await elementUnderTest.insertProcessed(
            {
                block_num: 2,
                block_id: 'b',
                block_time: new Date(),
                prev_block_hash: '',
                previous: '',
                transactions: [],
            },
            [],
            null,
        );

        const log_1 = await elementUnderTest.insertValidation(1, 'a');
        const log_2 = await elementUnderTest.insertValidation(2, 'b');

        expect(JSON.stringify(log_1)).not.toEqual(JSON.stringify(log_2));
    });
});
