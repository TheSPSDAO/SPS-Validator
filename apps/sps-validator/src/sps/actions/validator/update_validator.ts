import { OperationData, ValidatorRepository, Action, Trx, EventLog, HiveAccountRepository, ValidationError, ErrorType } from '@steem-monsters/splinterlands-validator';
import { update_validator } from '../schema';
import { MakeActionFactory, MakeRouter } from '../utils';
import { SpsValidatorLicenseManager } from '../../features/validator';
import { ValidatorEntry } from 'validator/src/entities/validator/validator';

export class UpdateValidatorAction extends Action<typeof update_validator.actionSchema> {
    constructor(
        op: OperationData,
        data: unknown,
        index: number,
        private readonly validatorRepository: ValidatorRepository,
        private readonly accountRepository: HiveAccountRepository,
        private readonly licenseManager: SpsValidatorLicenseManager,
    ) {
        super(update_validator, op, data, index);
    }

    async validate(trx?: Trx) {
        if (this.params.reward_account) {
            const valid = await this.accountRepository.onlyHiveAccounts([this.params.reward_account], trx);
            if (!valid) {
                throw new ValidationError('reward_account must be a valid hive account', this, ErrorType.AccountNotKnown);
            }

            if (this.params.reward_account === this.op.account) {
                throw new ValidationError('reward_account cannot be the same as the validator account', this, ErrorType.DuplicateAccount);
            }
        }
        return true;
    }

    async process(trx?: Trx): Promise<EventLog[]> {
        // Insert or update the validators table
        const events: EventLog[] = [];

        // possibly have to update the reward pool
        const validator = await this.validatorRepository.lookup(this.op.account, trx);
        if (validator && !this.params.is_active) {
            // setting to inactive
            events.push(...(await this.removeFromLicenseRewardPool(validator, trx)));
        } else if (validator && this.params.reward_account !== validator.reward_account) {
            // updating the reward account
            events.push(...(await this.removeFromLicenseRewardPool(validator, trx)));
        }

        events.push(
            await this.validatorRepository.register(
                {
                    account: this.op.account,
                    is_active: this.params.is_active,
                    post_url: this.params.post_url,
                    reward_account: this.params.reward_account ?? undefined,
                },
                trx,
            ),
        );

        return events;
    }

    private async removeFromLicenseRewardPool(validator: ValidatorEntry, trx?: Trx) {
        const events: EventLog[] = [];
        if (validator.reward_account) {
            // need to remove the reward account from the pool

            // check if any other validator is using this reward account, or if they have their own validator
            const { validators } = await this.validatorRepository.getValidators({ reward_account: validator.reward_account, is_active: true }, trx);
            const filtered = validators.filter((v) => v.account_name !== validator.account_name);
            const rewardAccountValidator = await this.validatorRepository.lookup(validator.reward_account, trx);
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

const Builder = MakeActionFactory(UpdateValidatorAction, ValidatorRepository, HiveAccountRepository, SpsValidatorLicenseManager);
export const Router = MakeRouter(update_validator.action_name, Builder);
