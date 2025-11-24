import { Action, EventLog, OperationData, Trx, ValidatorRepository, ValidatorWatch } from '@steem-monsters/splinterlands-validator';
import { update_missed_blocks } from '../schema';
import { MakeActionFactory, MakeRouter } from '../utils';
import { SpsValidatorLicenseManager } from '../../features/validator';
import { ValidatorEntry } from 'validator/src/entities/validator/validator';

export class UpdateMissedBlocksAction extends Action<typeof update_missed_blocks.actionSchema> {
    constructor(
        op: OperationData,
        data: unknown,
        index: number,
        private readonly validatorRepository: ValidatorRepository,
        private readonly validatorWatch: ValidatorWatch,
        private readonly licenseManager: SpsValidatorLicenseManager,
    ) {
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
        if (
            validator &&
            validator.is_active &&
            validator.consecutive_missed_blocks !== undefined &&
            missedBlocksThreshold !== 0 &&
            validator.consecutive_missed_blocks > missedBlocksThreshold
        ) {
            const disableLog = await this.validatorRepository.disable(this.params.account, this, trx);
            logs.push(disableLog);
            logs.push(...(await this.removeFromLicenseRewardPool(validator, trx)));
        }

        return logs;
    }

    private async removeFromLicenseRewardPool(validator: ValidatorEntry, trx?: Trx) {
        const events: EventLog[] = [];
        if (validator.reward_account) {
            // need to remove the reward account from the pool

            // check if any other validator is using this reward account, or if they have their own validator
            const { validators } = await this.validatorRepository.getValidators({ reward_account: validator.reward_account, is_active: true }, trx);
            const filtered = validators.filter((v) => v.account_name !== validator.account_name);
            const rewardAccountValidator = await this.validatorRepository.lookup(validator.reward_account, this.op.block_num, trx);
            if (filtered.length === 0 && (!rewardAccountValidator || !rewardAccountValidator.is_active)) {
                events.push(...(await this.licenseManager.expireCheckIn(validator.reward_account, this, trx)));
            }
        } else {
            // need to remove the validator

            // check if there are any validators that are using this validator as its reward account
            const { validators } = await this.validatorRepository.getValidators({ reward_account: validator.account_name, is_active: true }, trx);
            const filtered = validators.filter((v) => v.account_name !== validator.account_name);
            if (filtered.length === 0) {
                events.push(...(await this.licenseManager.expireCheckIn(validator.account_name, this, trx)));
            }
        }
        return events;
    }
}

const Builder = MakeActionFactory(UpdateMissedBlocksAction, ValidatorRepository, ValidatorWatch, SpsValidatorLicenseManager);
export const Router = MakeRouter(update_missed_blocks.action_name, Builder);
