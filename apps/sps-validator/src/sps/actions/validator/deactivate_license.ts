import { OperationData, Action, EventLog, Trx, ValidationError, ErrorType } from '@steem-monsters/splinterlands-validator';
import { deactivate_license } from '../schema';
import { MakeActionFactory, MakeRouter } from '../utils';
import { SpsValidatorLicenseManager } from '../../features/validator';

export class DeactivateLicenseAction extends Action<typeof deactivate_license.actionSchema> {
    constructor(op: OperationData, data: unknown, index: number, private readonly licenseManager: SpsValidatorLicenseManager) {
        super(deactivate_license, op, data, index);
    }

    async validate(trx?: Trx) {
        const { activatedLicenses } = await this.licenseManager.getLicenses(this.op.account, trx);
        if (activatedLicenses < this.params.qty) {
            throw new ValidationError('Not enough activated licenses', this, ErrorType.InsufficientBalance);
        }
        return true;
    }

    async process(trx?: Trx): Promise<EventLog[]> {
        return [...(await this.licenseManager.deactivateLicenses(this, this.op.account, this.params.qty, trx))];
    }
}

const Builder = MakeActionFactory(DeactivateLicenseAction, SpsValidatorLicenseManager);
export const Router = MakeRouter(deactivate_license.action_name, Builder);
