import { OperationData, Action, EventLog, Trx, ValidationError, ErrorType, HiveAccountRepository, ValidatorRepository } from '@steem-monsters/splinterlands-validator';
import { check_in_validator } from '../schema';
import { MakeActionFactory, MakeRouter } from '../utils';
import { SpsValidatorLicenseManager } from '../../features/validator';

export class CheckInValidatorAction extends Action<typeof check_in_validator.actionSchema> {
    constructor(
        op: OperationData,
        data: unknown,
        index: number,
        private readonly licenseManager: SpsValidatorLicenseManager,
        private readonly validatorRepository: ValidatorRepository,
    ) {
        super(check_in_validator, op, data, index);
    }

    async validate(trx?: Trx) {
        const validator = await this.validatorRepository.lookup(this.op.account, trx);
        if (!validator) {
            throw new ValidationError('Validator not found.', this, ErrorType.UnknownValidator);
        } else if (!validator.is_active) {
            throw new ValidationError('Validator is not active.', this, ErrorType.InactiveValidator);
        }

        const rewardAccount = validator.reward_account ?? this.op.account;
        const checkIn = await this.licenseManager.getCheckIn(rewardAccount, this.op.block_num, trx);
        if (!checkIn.can_check_in) {
            throw new ValidationError('Cannot check in at this block.', this, ErrorType.InvalidCheckIn);
        }

        const { block_num, hash } = this.params;
        const withinWindow = this.licenseManager.isCheckInBlockWithinWindow(this.op.block_num, block_num);
        if (!withinWindow) {
            throw new ValidationError('Check in block is too old.', this, ErrorType.InvalidCheckIn);
        }

        const expectedHash = await this.licenseManager.getCheckInHashForBlockNum(block_num, rewardAccount, trx);
        if (hash !== expectedHash) {
            throw new ValidationError('Invalid check in hash.', this, ErrorType.InvalidCheckIn);
        }

        return true;
    }

    async process(trx?: Trx): Promise<EventLog[]> {
        const validator = await this.validatorRepository.lookup(this.op.account, trx);
        const rewardAccount = validator!.reward_account ?? this.op.account;
        return [...(await this.licenseManager.checkIn(this, rewardAccount, trx))];
    }
}

const Builder = MakeActionFactory(CheckInValidatorAction, SpsValidatorLicenseManager, ValidatorRepository);
export const Router = MakeRouter(check_in_validator.action_name, Builder);
