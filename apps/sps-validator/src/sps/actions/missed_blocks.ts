import { BlockRef, BlockRepository, PrefixOpts, ProcessResult, Trx, ValidatorUpdater, ValidatorWatch, VirtualPayloadSource } from '@steem-monsters/splinterlands-validator';
import { inject, injectable } from 'tsyringe';

export type MissedBlocksOpts = {
    missed_blocks_account: string;
};
export const MissedBlocksOpts: unique symbol = Symbol('MissedBlocksOpts');

@injectable()
export class SpsUpdateMissedBlocksSource implements VirtualPayloadSource {
    constructor(
        @inject(BlockRepository) private readonly blockRepository: BlockRepository,
        @inject(PrefixOpts) private readonly prefixOpts: PrefixOpts,
        @inject(MissedBlocksOpts) private readonly missedBlocksOpts: MissedBlocksOpts,
        @inject(ValidatorWatch) private readonly validatorWatch: ValidatorWatch,
        @inject(ValidatorUpdater) private readonly validatorUpdater: ValidatorUpdater,
    ) {}

    trx_id(block: BlockRef): string {
        return `update_missed_blocks_${block.block_num}@${block.block_time.getTime()}`;
    }

    async process(block: BlockRef, trx?: Trx): Promise<ProcessResult[]> {
        if (!this.validatorWatch.validator) {
            return [];
        }

        // -1 because their validation could be in this block
        const expired_block = block.block_num - 1 - this.validatorWatch.validator?.max_block_age;
        const last_checked_block = this.validatorWatch.validator?.last_checked_block;

        // note: this update doesn't get included in the block hash but it doesn't matter. we always update this no matter what though.
        await this.validatorUpdater.updateLastCheckedBlock(expired_block, trx);

        // don't bother if we're before the reward start block
        if (expired_block < this.validatorWatch.validator.reward_start_block) {
            return [];
        }

        const missed_blocks = await this.blockRepository.getMissedBlocks(last_checked_block, expired_block, trx);
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

        const entries = Object.entries(byAccount).sort((a, b) => b[1] - a[1]);
        if (entries.length === 0) {
            return [];
        }

        return entries.map(([account, missed_blocks]) => {
            return [
                'custom_json',
                {
                    required_auths: [this.missedBlocksOpts.missed_blocks_account],
                    required_posting_auths: [],
                    id: this.prefixOpts.custom_json_id,
                    json: {
                        action: 'update_missed_blocks',
                        params: {
                            account,
                            checked_block: expired_block,
                            missed_blocks,
                        },
                    },
                },
            ];
        });
    }
}
