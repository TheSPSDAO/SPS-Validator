import { OperationData, HiveAccountRepository, Action, Trx, ValidationError, ErrorType } from '@steem-monsters/splinterlands-validator';
import { set_authority } from '../schema';
import { MakeActionFactory, MakeRouter } from '../utils';

export class SetAuthorityAction extends Action<typeof set_authority.actionSchema> {
    constructor(op: OperationData, data: unknown, index: number, protected readonly hiveAccountRepository: HiveAccountRepository) {
        super(set_authority, op, data, index);
    }

    async validate(trx?: Trx) {
        const authority = {
            delegation: this.params.delegation,
        };
        const accounts = Object.values(authority).flatMap((accounts) => accounts);
        const valid_accounts = await this.hiveAccountRepository.onlyHiveAccounts(accounts, trx);
        if (!valid_accounts) {
            throw new ValidationError('One or more of the accounts are not valid Hive accounts.', this, ErrorType.AccountNotKnown);
        }
        return true;
    }

    async process(trx?: Trx) {
        const authority = {
            delegation: this.params.delegation,
        };
        const event_log = await this.hiveAccountRepository.setAuthority(this.op.account, authority, trx);
        return [event_log];
    }
}

const Builder = MakeActionFactory(SetAuthorityAction, HiveAccountRepository);
export const Router = MakeRouter(set_authority.action_name, Builder);
