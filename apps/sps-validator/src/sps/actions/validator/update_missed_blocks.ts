import { Action, EventLog, OperationData, Trx, ValidatorRepository } from '@steem-monsters/splinterlands-validator';
import { update_missed_blocks } from '../schema';
import { MakeActionFactory, MakeRouter } from '../utils';

export class UpdateMissedBlocksAction extends Action<typeof update_missed_blocks.actionSchema> {
    constructor(op: OperationData, data: unknown, index: number, private readonly validatorRepository: ValidatorRepository) {
        super(update_missed_blocks, op, data, index);
    }

    async validate() {
        return true;
    }

    async process(trx?: Trx): Promise<EventLog[]> {
        return [...(await this.validatorRepository.incrementMissedBlocks(this.op.account, this.params.missed_blocks, trx))];
    }
}

const Builder = MakeActionFactory(UpdateMissedBlocksAction, ValidatorRepository);
export const Router = MakeRouter(update_missed_blocks.action_name, Builder);
