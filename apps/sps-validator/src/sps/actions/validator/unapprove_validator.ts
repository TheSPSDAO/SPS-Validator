import { Action, ErrorType, EventLog, OperationData, Trx, ValidationError, ValidatorVoteRepository } from '@steem-monsters/splinterlands-validator';
import { unapprove_validator } from '../schema';
import { MakeActionFactory, MakeRouter } from '../utils';

export class UnapproveValidatorAction extends Action<typeof unapprove_validator.actionSchema> {
    constructor(op: OperationData, data: unknown, index: number, private readonly validatorVoteRepository: ValidatorVoteRepository) {
        super(unapprove_validator, op, data, index);
    }

    async validate(trx?: Trx) {
        const votes = await this.validatorVoteRepository.lookupByVoter(this.op.account, trx);

        // Make sure the account is currently voting for the specified validator that they wish to unapprove
        if (!votes || !votes.find((v) => v.validator === this.params.account_name)) {
            throw new ValidationError('This account is not currently voting for the specified validator.', this, ErrorType.NoSuchValidatorVote);
        }

        return true;
    }

    async process(trx?: Trx): Promise<EventLog[]> {
        return await this.validatorVoteRepository.delete(this, trx);
    }
}

const Builder = MakeActionFactory(UnapproveValidatorAction, ValidatorVoteRepository);
export const Router = MakeRouter(unapprove_validator.action_name, Builder);
