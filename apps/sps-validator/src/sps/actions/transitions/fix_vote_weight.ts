import { OperationData, Action, EventLog, Trx, Handle, BaseRepository, ValidatorVoteRepository, RawResult } from '@steem-monsters/splinterlands-validator';
import { transition_fix_vote_weight } from '../schema';
import { MakeActionFactory, MakeRouter } from '../utils';
import { TransitionManager } from '../../features/transition';

type InvalidVoteWeight = {
    voter: string;
    balance: number;
    vote_weight: number;
};

class FixVoteWeightRepository extends BaseRepository {
    constructor(handle: Handle) {
        super(handle);
    }

    async getInvalidVoteWeights(trx?: Trx) {
        const results = await this.queryRaw(trx).raw<RawResult<InvalidVoteWeight>>(
            `
                SELECT
                    vote_weight.voter       AS voter,
                    vote_weight.vote_weight AS vote_weight,
                    balance.balance         AS balance
                FROM
                    balances balance
                JOIN
                    (
                        SELECT
                            voter,
                            MAX(vote_weight) AS vote_weight
                        FROM
                            validator_votes
                        GROUP BY
                            voter
                    ) vote_weight
                ON
                    balance.player = vote_weight.voter
                WHERE
                    balance.token = 'SPSP' AND balance.balance != vote_weight.vote_weight
                ORDER BY
                    vote_weight.voter DESC
            `,
        );
        return results.rows.map((result) => ({
            voter: result.voter,
            balance: parseFloat(result.balance as unknown as string),
            vote_weight: parseFloat(result.vote_weight as unknown as string),
        }));
    }
}

export class FixVoteWeightTransitionAction extends Action<typeof transition_fix_vote_weight.actionSchema> {
    constructor(
        op: OperationData,
        data: unknown,
        index: number,
        private readonly handle: Handle,
        private readonly voteRepository: ValidatorVoteRepository,
        private readonly transitionManager: TransitionManager,
    ) {
        super(transition_fix_vote_weight, op, data, index);
    }

    override isSupported(): boolean {
        return this.op.account === this.transitionManager.transitionAccount && this.transitionManager.isTransitionPoint('fix_vote_weight', this.op.block_num);
    }

    async validate() {
        return true;
    }

    async process(trx?: Trx): Promise<EventLog[]> {
        const invalidVoteWeights = await new FixVoteWeightRepository(this.handle).getInvalidVoteWeights(trx);
        const events: EventLog[] = [];
        for (const invalidVoteWeight of invalidVoteWeights) {
            const setEvents = await this.voteRepository.setVoteWeight(invalidVoteWeight.voter, invalidVoteWeight.balance, trx);
            events.push(...setEvents);
        }
        return events;
    }
}

const Builder = MakeActionFactory(FixVoteWeightTransitionAction, Handle, ValidatorVoteRepository, TransitionManager);
export const Router = MakeRouter(transition_fix_vote_weight.action_name, Builder);
