import { OperationData, Action, EventLog, Trx, ValidationError, ErrorType } from '@steem-monsters/splinterlands-validator';
import { expire_check_ins } from '../schema';
import { MakeActionFactory, MakeRouter } from '../utils';
import { SpsValidatorLicenseManager } from '../../features/validator/license-manager';

export class ExpireCheckInsAction extends Action<typeof expire_check_ins.actionSchema> {
    constructor(op: OperationData, data: unknown, index: number, private readonly licenseManager: SpsValidatorLicenseManager) {
        super(expire_check_ins, op, data, index);
    }

    async validate() {
        if (this.op.account !== SpsValidatorLicenseManager.LICENSE_MANAGER_ACCOUNT) {
            throw new ValidationError('Only the system account can expire check ins', this, ErrorType.MismatchedAccount);
        }
        return true;
    }

    async process(trx?: Trx): Promise<EventLog[]> {
        return [...(await this.licenseManager.expireCheckIns(this, trx))];
    }
}

const Builder = MakeActionFactory(ExpireCheckInsAction, SpsValidatorLicenseManager);
export const Router = MakeRouter(expire_check_ins.action_name, Builder);
