import { BlockRef, BlockRepository, PrefixOpts, ProcessResult, Trx, ValidatorWatch, VirtualPayloadSource } from '@steem-monsters/splinterlands-validator';
import { inject, injectable } from 'tsyringe';

export type MissedBlocksOpts = {
    update_account: string;
};
export const MissedBlocksOpts: unique symbol = Symbol('MissedBlocksOpts');

@injectable()
export class SpsUpdateMissedBlocksSource implements VirtualPayloadSource {
    constructor(
        @inject(BlockRepository) private readonly blockRepository: BlockRepository,
        @inject(PrefixOpts) private readonly prefixOpts: PrefixOpts,
        @inject(MissedBlocksOpts) private readonly missedBlocksOpts: MissedBlocksOpts,
        @inject(ValidatorWatch) private readonly validatorWatch: ValidatorWatch,
    ) {}

    trx_id(block: BlockRef): string {
        return `update_missed_blocks_${block.block_num}@${block.block_time.getTime()}`;
    }

    async process(block: BlockRef, trx?: Trx): Promise<ProcessResult[]> {
        if (!this.validatorWatch.validator) {
            return [];
        }

        // block 1, expiration 100, so on block 102 we check for missed blocks from 1 (102 - 100 = 2)
        const expired_block = block.block_num - this.validatorWatch.validator?.max_block_age;
        const missed_blocks = await this.blockRepository.getMissedBlocks(expired_block, trx);
        if (missed_blocks.length === 0) {
            return [];
        }

        const byAccount = missed_blocks.reduce((acc, block) => {
            if (!block.validator) {
                return acc;
            }
            if (!acc[block.validator]) {
                acc[block.validator] = 0;
            }
            acc[block.validator]++;
            return acc;
        }, {} as Record<string, number>);

        const entries = Object.entries(byAccount);
        if (entries.length === 0) {
            return [];
        }

        return entries.map(([account, amount]) => {
            return [
                'custom_json',
                {
                    required_auths: [this.missedBlocksOpts.update_account],
                    required_posting_auths: [],
                    id: this.prefixOpts.custom_json_id,
                    json: {
                        action: 'update_missed_blocks',
                        params: {
                            account,
                            amount,
                        },
                    },
                },
            ];
        });
    }
}
