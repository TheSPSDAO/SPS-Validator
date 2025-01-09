import { ValidatorVoteHistoryRepository } from './validator_vote_history';
import { EventLog, EventTypes } from '../event_log';
import { BaseRepository, Handle, RawResult, Trx, ValidatorEntity, ValidatorVoteEntity } from '../../db/tables';
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

        return [
            ...(await this.syncValidatorVotes([validator], trx)),
            await this.validatorVoteHistoryRepository.insert(action, true, balance, trx),
            new EventLog(EventTypes.INSERT, ValidatorVoteEntity, vote),
        ];
    }

    async delete(action: VotingAction, trx?: Trx): Promise<EventLog[]> {
        const balance = await this.voteWeightCalculator.calculateVoteWeight(action.op.account, trx);
        const validator = action.params.account_name;

        const vote = await this.query(ValidatorVoteEntity, trx)
            .where('voter', action.op.account)
            .where('validator', validator)
            .useKnexQueryBuilder((query) => query.returning('*').del())
            .orderBy('validator')
            .orderBy('voter')
            .getMany();
        const deleteVote = new EventLog(EventTypes.DELETE, ValidatorVoteEntity, vote);
        const syncedValidators = await this.syncValidatorVotes([validator], trx);
        const insertValidatorHistory = await this.validatorVoteHistoryRepository.insert(action, false, balance, trx);
        return [deleteVote, ...syncedValidators, insertValidatorHistory];
    }

    async incrementVoteWeight(voter: string, amount: number, trx?: Trx): Promise<EventLog[]> {
        // Update all of the vote weights in the validator_votes table
        const votes = await this.query(ValidatorVoteEntity, trx)
            .where('voter', voter)
            .useKnexQueryBuilder((query) => query.increment('vote_weight', amount).returning('*'))
            .orderBy('validator')
            .orderBy('voter')
            .getMany();

        const voteEvents = votes.map((v) => new EventLog(EventTypes.UPDATE, ValidatorVoteEntity, v));

        if (votes.length > 0) {
            const setVotesEvents = await this.syncValidatorVotes(
                votes.map((v) => v.validator),
                trx,
            );
            return [...voteEvents, ...setVotesEvents];
        } else {
            return voteEvents;
        }
    }

    async setVoteWeight(voter: string, weight: number, trx?: Trx): Promise<EventLog[]> {
        // Update all of the vote weights in the validator_votes table
        const votes = await this.query(ValidatorVoteEntity, trx)
            .where('voter', voter)
            .useKnexQueryBuilder((query) => query.update('vote_weight', weight).returning('*'))
            .orderBy('validator')
            .orderBy('voter')
            .getMany();

        const voteEvents = votes.map((v) => new EventLog(EventTypes.UPDATE, ValidatorVoteEntity, v));

        if (votes.length > 0) {
            const setVotesEvents = await this.syncValidatorVotes(
                votes.map((v) => v.validator),
                trx,
            );
            return [...voteEvents, ...setVotesEvents];
        } else {
            return voteEvents;
        }
    }

    private async syncValidatorVotes(validators: string[], trx?: Trx) {
        // Update the total_votes for all of the affected validators
        // note: this requires the search path to be set to include the schema the validator is using, which it should be
        const total_votes = await this.queryRaw(trx).raw<RawResult<ValidatorVoteEntity>>(
            `
            UPDATE validators v
            SET total_votes = summed.total_votes
            FROM (
                SELECT
                    validator,
                    SUM(vote_weight) as total_votes
                FROM
                    validator_votes vote
                WHERE
                    vote.validator = ANY(:validators)
                GROUP BY
                    validator
                ORDER BY validator
            ) summed
            WHERE v.account_name = summed.validator
            RETURNING v.*;
            `,
            { validators },
        );
        return total_votes.rows.map((v) => new EventLog(EventTypes.UPDATE, ValidatorEntity, v));
    }
}
