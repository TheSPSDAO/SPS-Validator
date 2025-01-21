import { OperationData, Action, EventLog, Trx, ValidationError, ErrorType } from '@steem-monsters/splinterlands-validator';
import { activate_license } from '../schema';
import { MakeActionFactory, MakeRouter } from '../utils';
import { SpsValidatorLicenseManager } from '../../features/validator/license-manager';

export class ActivateLicenseAction extends Action<typeof activate_license.actionSchema> {
    constructor(op: OperationData, data: unknown, index: number, private readonly licenseManager: SpsValidatorLicenseManager) {
        super(activate_license, op, data, index);
    }

    async validate(trx?: Trx) {
        const { licenses } = await this.licenseManager.getLicenses(this.op.account, trx);
        if (licenses < this.params.qty) {
            throw new ValidationError('Not enough licenses', this, ErrorType.InsufficientBalance);
        }
        return true;
    }

    async process(trx?: Trx): Promise<EventLog[]> {
        return [...(await this.licenseManager.activateLicenses(this, this.op.account, this.params.qty, trx))];
    }
}

const Builder = MakeActionFactory(ActivateLicenseAction, SpsValidatorLicenseManager);
export const Router = MakeRouter(activate_license.action_name, Builder);
