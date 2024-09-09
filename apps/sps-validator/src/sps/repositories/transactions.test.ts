import { Fixture as BaseFixture } from '../../__tests__/fixture';
import { inject, injectable } from 'tsyringe';
import { container } from '../../__tests__/test-composition-root';
import { TransactionRepository_ } from '@steem-monsters/splinterlands-validator';

@injectable()
class Fixture extends BaseFixture {
    constructor(@inject(TransactionRepository_) readonly transactionsRepo: TransactionRepository_) {
        super();
    }
}

describe('Transactions Repo', () => {
    const fixture = container.resolve(Fixture);

    beforeAll(async () => {
        await fixture.init();
        await fixture.restore();
        await fixture.testHelper.insertBlocksAndTransaction();
    });

    afterAll(async () => {
        await fixture.dispose();
    });

    test.dbOnly.each`
        block_num | transaction_ids               | transfer_ids
        ${0}      | ${[]}                         | ${[]}
        ${1}      | ${[{ id: 'A' }, { id: 'D' }]} | ${[{ id: 'A' }]}
        ${2}      | ${[{ id: 'B' }]}              | ${[{ id: 'B' }]}
        ${3}      | ${[]}                         | ${[]}
    `(`Checking [$block_num] for transactions containing [$transaction_ids] and transfers containing [$transfer_ids]`, async ({ block_num, transaction_ids, transfer_ids }) => {
        const transactions = await fixture.transactionsRepo.lookupByBlockNum(block_num);
        checkContents(transactions, transaction_ids);
        const transfers = await fixture.transactionsRepo.lookupTokenTransferByBlockNum(block_num);
        checkContents(transfers, transfer_ids);
    });

    function checkContents(array: any[], expectedContent: []) {
        expect(array!.length).toBe(expectedContent.length);
        for (const content of expectedContent) {
            expect(array).toEqual(expect.arrayContaining([expect.objectContaining(content)]));
        }
    }
});
