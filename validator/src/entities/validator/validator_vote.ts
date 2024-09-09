import { ValidatorVoteHistoryRepository } from './validator_vote_history';
import { EventLog, EventTypes } from '../event_log';
import { BaseRepository, Handle, Trx, ValidatorEntity, ValidatorVoteEntity } from '../../db/tables';
import { ValidatorVoteEntry, VoteWeightCalculator, VotingAction } from './types';

export class ValidatorVoteRepository extends BaseRepository {
    constructor(handle: Handle, private readonly voteWeightCalculator: VoteWeightCalculator, private readonly validatorVoteHistoryRepository: ValidatorVoteHistoryRepository) {
        super(handle);
    }

    private static into(row: ValidatorVoteEntity): ValidatorVoteEntry {
        return { ...row, vote_weight: parseFloat(row.vote_weight) };
    }
    private static from(entry: ValidatorVoteEntry): ValidatorVoteEntity {
        return { ...entry, vote_weight: String(entry.vote_weight) };
    }

    lookupByVoter(voter: string, trx?: Trx) {
        return this.query(ValidatorVoteEntity, trx).where('voter', voter).getMany();
    }

    lookupByValidator(validator: string, trx?: Trx) {
        return this.query(ValidatorVoteEntity, trx).where('validator', validator).getMany();
    }

    async insert(action: VotingAction, trx?: Trx) {
        const balance = await this.voteWeightCalculator.calculateVoteWeight(action.op.account, trx);
        const validator = action.params.account_name;
        const vote = this.query(ValidatorVoteEntity, trx).insertItemWithReturning(
            ValidatorVoteRepository.from({
                voter: action.op.account,
                validator,
                vote_weight: balance,
            }),
        );

        // Increment the total_votes for the validator
        await this.updateVoteWeight(validator, balance, trx);

        // Insert a new vote history record
        await this.validatorVoteHistoryRepository.insert(action, true, balance, trx);

        return new EventLog(EventTypes.INSERT, ValidatorVoteEntity, vote);
    }

    async delete(action: VotingAction, trx?: Trx): Promise<EventLog[]> {
        const balance = await this.voteWeightCalculator.calculateVoteWeight(action.op.account, trx);
        const validator = action.params.account_name;

        const vote = await this.query(ValidatorVoteEntity, trx)
            .where('voter', action.op.account)
            .where('validator', validator)
            .useKnexQueryBuilder((query) => query.returning('*').del())
            .getMany();
        const deleteVote = new EventLog(EventTypes.DELETE, ValidatorVoteEntity, vote);
        const decrementTotalVotes = await this.updateVoteWeight(validator, balance * -1, trx);
        const insertValidatorHistory = await this.validatorVoteHistoryRepository.insert(action, false, balance, trx);
        return [deleteVote, ...decrementTotalVotes, insertValidatorHistory];
    }

    async updateVoteWeight(voter: string, amount: number, trx?: Trx): Promise<EventLog[]> {
        // Update all of the vote weights in the validator_votes table
        const votes = await this.query(ValidatorVoteEntity, trx)
            .where('voter', voter)
            .useKnexQueryBuilder((query) => query.increment('vote_weight', amount).returning('*'))
            .getMany();

        if (votes.length > 0) {
            const results: EventLog[] = [new EventLog(EventTypes.UPDATE, ValidatorVoteEntity, votes)];
            // Update the total_votes for all of the affected validators
            const total_votes = await this.query(ValidatorEntity, trx)
                .whereIn(
                    'account_name',
                    votes.map((v) => v.validator),
                )
                .useKnexQueryBuilder((query) => query.increment('total_votes', amount).returning('*'))
                .getMany();
            results.push(new EventLog(EventTypes.UPDATE, ValidatorEntity, total_votes));
            return results;
        } else {
            return [];
        }
    }
}
