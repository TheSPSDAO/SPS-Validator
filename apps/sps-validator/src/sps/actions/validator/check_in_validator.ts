import { OperationData, Action, EventLog, Trx, ValidationError, ErrorType, HiveAccountRepository } from '@steem-monsters/splinterlands-validator';
import { check_in_validator } from '../schema';
import { MakeActionFactory, MakeRouter } from '../utils';
import { SpsValidatorLicenseManager } from '../../features/validator/license-manager';

export class CheckInValidatorAction extends Action<typeof check_in_validator.actionSchema> {
    private readonly reward_account: string;
    constructor(
        op: OperationData,
        data: unknown,
        index: number,
        private readonly licenseManager: SpsValidatorLicenseManager,
        private readonly accountRepository: HiveAccountRepository,
    ) {
        super(check_in_validator, op, data, index);
        this.reward_account = this.params.reward_account ?? this.op.account;
    }

    async validate(trx?: Trx) {
        const validRewardAccount = await this.accountRepository.onlyHiveAccounts([this.reward_account], trx);
        if (!validRewardAccount) {
            throw new ValidationError('The specified reward account does not exist.', this, ErrorType.AccountNotKnown);
        }

        const checkIn = await this.licenseManager.getCheckIn(this.reward_account, this.op.block_num, trx);
        if (!checkIn.can_check_in) {
            throw new ValidationError('Cannot check in at this block.', this, ErrorType.InvalidCheckIn);
        }

        const { block_num, hash } = this.params;
        const withinWindow = this.licenseManager.isCheckInBlockWithinWindow(this.op.block_num, block_num);
        if (!withinWindow) {
            throw new ValidationError('Check in block is too old.', this, ErrorType.InvalidCheckIn);
        }

        const expectedHash = await this.licenseManager.getCheckInHashForBlockNum(block_num, this.reward_account, trx);
        if (hash !== expectedHash) {
            throw new ValidationError('Invalid check in hash.', this, ErrorType.InvalidCheckIn);
        }

        return true;
    }

    async process(trx?: Trx): Promise<EventLog[]> {
        return [...(await this.licenseManager.checkIn(this, this.reward_account, trx))];
    }
}

const Builder = MakeActionFactory(CheckInValidatorAction, SpsValidatorLicenseManager, HiveAccountRepository);
export const Router = MakeRouter(check_in_validator.action_name, Builder);
