import { OperationData, Action, EventLog, Trx, ValidationError, ErrorType } from '@steem-monsters/splinterlands-validator';
import { check_in_validator } from '../schema';
import { MakeActionFactory, MakeRouter } from '../utils';
import { SpsValidatorLicenseManager } from '../../features/validator/validator_license.manager';

export class CheckInValidatorAction extends Action<typeof check_in_validator.actionSchema> {
    constructor(op: OperationData, data: unknown, index: number, private readonly licenseManager: SpsValidatorLicenseManager) {
        super(check_in_validator, op, data, index);
    }

    async validate(trx?: Trx) {
        const checkIn = await this.licenseManager.getCheckIn(this.op.account, this.op.block_num, trx);
        if (!checkIn.can_check_in) {
            throw new ValidationError('Cannot check in at this block.', this, ErrorType.InvalidCheckIn);
        }

        const { block_num, hash } = this.params;
        const expectedHash = await this.licenseManager.getCheckInHashForBlockNum(block_num, this.op.account, trx);
        if (hash !== expectedHash) {
            throw new ValidationError('Invalid check in hash.', this, ErrorType.InvalidCheckIn);
        }

        return true;
    }

    async process(trx?: Trx): Promise<EventLog[]> {
        return [...(await this.licenseManager.checkIn(this, this.op.account, trx))];
    }
}

const Builder = MakeActionFactory(CheckInValidatorAction, SpsValidatorLicenseManager);
export const Router = MakeRouter(check_in_validator.action_name, Builder);
