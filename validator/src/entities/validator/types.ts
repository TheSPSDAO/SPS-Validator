import { IAction } from '../../actions/action';
import { Trx } from '../../db/tables';

export type ValidatorVoteEntry = {
    voter: string;
    validator: string;
    vote_weight: number;
};

export type VotingAction = IAction & { params: { account_name: string } };

export interface VoteWeightCalculator {
    calculateVoteWeight(account: string, trx?: Trx): Promise<number>;
}
export const VoteWeightCalculator: unique symbol = Symbol('VoteWeightCalculator');
