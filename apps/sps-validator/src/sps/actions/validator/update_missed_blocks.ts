import { Action, EventLog, OperationData, Trx, ValidatorRepository, ValidatorWatch } from '@steem-monsters/splinterlands-validator';
import { update_missed_blocks } from '../schema';
import { MakeActionFactory, MakeRouter } from '../utils';

export class UpdateMissedBlocksAction extends Action<typeof update_missed_blocks.actionSchema> {
    constructor(op: OperationData, data: unknown, index: number, private readonly validatorRepository: ValidatorRepository, private readonly validatorWatch: ValidatorWatch) {
        super(update_missed_blocks, op, data, index);
    }

    async validate() {
        return true;
    }

    async process(trx?: Trx): Promise<EventLog[]> {
        const logs = [...(await this.validatorRepository.incrementMissedBlocks(this.params.account, this.params.missed_blocks, this, trx))];
        const validator = await this.validatorRepository.lookup(this.params.account, this.op.block_num, trx);

        // if the validator has a consecutive missed blocks threshold and the validator has exceeded it, disable the validator
        const missedBlocksThreshold = this.validatorWatch.validator?.consecutive_missed_blocks_threshold ?? 0;
        if (validator && validator.consecutive_missed_blocks !== undefined && missedBlocksThreshold !== 0 && validator.consecutive_missed_blocks > missedBlocksThreshold) {
            logs.push(await this.validatorRepository.disable(this.params.account, this, trx));
        }

        return logs;
    }
}

const Builder = MakeActionFactory(UpdateMissedBlocksAction, ValidatorRepository, ValidatorWatch);
export const Router = MakeRouter(update_missed_blocks.action_name, Builder);
