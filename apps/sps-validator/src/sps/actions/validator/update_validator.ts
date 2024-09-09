import { OperationData, ValidatorRepository, Action, Trx, EventLog } from '@steem-monsters/splinterlands-validator';
import { update_validator } from '../schema';
import { MakeActionFactory, MakeRouter } from '../utils';

export class UpdateValidatorAction extends Action<typeof update_validator.actionSchema> {
    constructor(op: OperationData, data: unknown, index: number, private readonly validatorRepository: ValidatorRepository) {
        super(update_validator, op, data, index);
    }

    async validate(_trx?: Trx) {
        return true;
    }

    async process(trx?: Trx): Promise<EventLog[]> {
        // Insert or update the validators table
        return [
            await this.validatorRepository.register(
                {
                    account: this.op.account,
                    is_active: this.params.is_active,
                    post_url: this.params.post_url,
                },
                trx,
            ),
        ];
    }
}

const Builder = MakeActionFactory(UpdateValidatorAction, ValidatorRepository);
export const Router = MakeRouter(update_validator.action_name, Builder);
