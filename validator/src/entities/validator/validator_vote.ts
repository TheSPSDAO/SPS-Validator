import { ValidatorVoteHistoryRepository } from './validator_vote_history';
import { EventLog, EventTypes } from '../event_log';
import { BaseRepository, Handle, RawResult, Trx, ValidatorEntity, ValidatorVoteEntity } from '../../db/tables';
import { ValidatorVoteEntry, VoteWeightCalculator, VotingAction } from './types';
import { ValidatorEntryVersion } from './validator';

export class ValidatorVoteRepository extends BaseRepository {
    constructor(handle: Handle, private readonly voteWeightCalculator: VoteWeightCalculator, private readonly validatorVoteHistoryRepository: ValidatorVoteHistoryRepository) {
        super(handle);
    }

    private static from(entry: ValidatorVoteEntry): ValidatorVoteEntity {
        return { ...entry, vote_weight: String(entry.vote_weight) };
    }

    // we should be using ValidatorEntry in this repo but we didnt, so we're stuck with duplicating this.
    protected validatorEntryVersion(block_num: number): ValidatorEntryVersion {
        return 'v1';
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
            ...(await this.syncValidatorVotes([validator], action.op.block_num, trx)),
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
        const syncedValidators = await this.syncValidatorVotes([validator], action.op.block_num, trx);
        const insertValidatorHistory = await this.validatorVoteHistoryRepository.insert(action, false, balance, trx);
        return [deleteVote, ...syncedValidators, insertValidatorHistory];
    }

    async incrementVoteWeight(voter: string, amount: number, block_num: number, trx?: Trx): Promise<EventLog[]> {
        // Update all of the vote weights in the validator_votes table
        const votes = await this.query(ValidatorVoteEntity, trx)
            .where('voter', voter)
            .useKnexQueryBuilder((query) => query.increment('vote_weight', amount).returning('*'))
            .getMany();

        const sortedVotes = votes.sort((a, b) => a.validator.localeCompare(b.validator) || a.voter.localeCompare(b.voter));
        const voteEvents = sortedVotes.map((v) => new EventLog(EventTypes.UPDATE, ValidatorVoteEntity, v));

        if (sortedVotes.length > 0) {
            const setVotesEvents = await this.syncValidatorVotes(
                sortedVotes.map((v) => v.validator),
                block_num,
                trx,
            );
            return [...voteEvents, ...setVotesEvents];
        } else {
            return voteEvents;
        }
    }

    async setVoteWeight(voter: string, weight: number, block_num: number, trx?: Trx): Promise<EventLog[]> {
        // Update all of the vote weights in the validator_votes table
        const votes = await this.query(ValidatorVoteEntity, trx)
            .where('voter', voter)
            .useKnexQueryBuilder((query) => query.update('vote_weight', weight).returning('*'))
            .getMany();

        const sortedVotes = votes.sort((a, b) => a.validator.localeCompare(b.validator) || a.voter.localeCompare(b.voter));
        const voteEvents = sortedVotes.map((v) => new EventLog(EventTypes.UPDATE, ValidatorVoteEntity, v));

        if (sortedVotes.length > 0) {
            const setVotesEvents = await this.syncValidatorVotes(
                sortedVotes.map((v) => v.validator),
                block_num,
                trx,
            );
            return [...voteEvents, ...setVotesEvents];
        } else {
            return voteEvents;
        }
    }

    private async syncValidatorVotes(validators: string[], block_num: number, trx?: Trx) {
        // Update the total_votes for all of the affected validators
        // note: this requires the search path to be set to include the schema the validator is using, which it should be
        const updatedValidators = await this.queryRaw(trx).raw<RawResult<ValidatorEntity>>(
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
        const sortedUpdatedValidators = updatedValidators.rows.sort((a, b) => a.account_name.localeCompare(b.account_name));
        return sortedUpdatedValidators.map((v) => {
            // this is a big hack.
            const version = this.validatorEntryVersion(block_num);
            const entry = { ...v } as Omit<ValidatorEntity, 'consecutive_missed_blocks'> & { consecutive_missed_blocks?: number };
            if (version === 'v1') {
                delete entry.consecutive_missed_blocks;
            }
            return new EventLog(EventTypes.UPDATE, ValidatorEntity, entry);
        });
    }
}
