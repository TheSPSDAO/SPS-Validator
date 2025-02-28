import {
    OperationData,
    ValidatorRepository,
    ValidatorVoteRepository,
    ValidatorWatch,
    Action,
    ErrorType,
    EventLog,
    Trx,
    ValidationError,
} from '@steem-monsters/splinterlands-validator';
import { approve_validator } from '../schema';
import { MakeActionFactory, MakeRouter } from '../utils';

export class ApproveValidatorAction extends Action<typeof approve_validator.actionSchema> {
    constructor(
        op: OperationData,
        data: unknown,
        index: number,
        private readonly watcher: ValidatorWatch,
        private readonly validatorRepository: ValidatorRepository,
        private readonly validatorVoteRepository: ValidatorVoteRepository,
    ) {
        super(approve_validator, op, data, index);
    }

    async validate(trx?: Trx) {
        const validator = await this.validatorRepository.lookup(this.params.account_name, trx);

        if (!validator) {
            throw new ValidationError('Specified validator not found.', this, ErrorType.UnknownValidator);
        }

        const votes = await this.validatorVoteRepository.lookupByVoter(this.op.account, trx);
        if (votes && votes.find((v) => v.validator === this.params.account_name)) {
            throw new ValidationError('This account has already voted for the specified validator.', this, ErrorType.DoubleValidatorVote);
        }

        const max_votes = this.watcher.validator?.max_votes;
        if (max_votes === undefined) {
            throw new ValidationError('This validator node has an incompatible configuration. try again later', this, ErrorType.MisconfiguredValidator);
        }

        if (votes && votes.length >= max_votes) {
            throw new ValidationError('This account has already voted for the maximum allowed number of validators.', this, ErrorType.MaxValidatorVotes);
        }

        return true;
    }

    async process(trx?: Trx): Promise<EventLog[]> {
        return await this.validatorVoteRepository.insert(this, trx);
    }
}

const Builder = MakeActionFactory(ApproveValidatorAction, ValidatorWatch, ValidatorRepository, ValidatorVoteRepository);
export const Router = MakeRouter(approve_validator.action_name, Builder);
