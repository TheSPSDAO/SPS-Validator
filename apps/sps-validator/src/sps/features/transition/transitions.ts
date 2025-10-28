import { BlockRef, PrefixOpts, ProcessResult, VirtualPayloadSource } from '@steem-monsters/splinterlands-validator';
import { inject, singleton } from 'tsyringe';

type MakeTransitionPoints<TPoints extends string> = {
    [K in TPoints]: number;
};

export type TransitionPoints = {
    transition_points: MakeTransitionPoints<'fix_vote_weight' | 'bad_block_96950550' | 'validator_transition_cleanup' | 'token_distribution_strategy'>;
};
export const TransitionPointDescriptions: Record<TransitionPointName, string> = {
    fix_vote_weight: 'Transition point for fixing vote weights when unstaking SPS. This is a one-time transition point that is part of version 1.1.0.',
    bad_block_96950550:
        'Transition point for skipping transactions in block 96950550 because of a splinterlands node issue. This is a one-time transition point that is part of version 1.1.3 to support replaying from initial snapshot.',
    validator_transition_cleanup:
        'Transition point for cleaning up validator state after the splinterlands -> validator transition. This is a one-time transition point that is part of version 1.2.0. Please see https://peakd.com/spsproposal/@clayboyn/sps-governance-proposal-sps-validator-transition-cleanup',
    token_distribution_strategy:
        'Transition point for changing the SPS staking reward algorithm. This is a one-time transition point that is part of version 1.3.0. Please see https://peakd.com/spsproposal/@clayboyn/sps-governance-proposal-adjust-token-distribution-strategy',
};

export const TransitionPoints: unique symbol = Symbol('TransitionPoints');
export type TransitionPointName = keyof TransitionPoints['transition_points'];
export type TransitionPointsStatuses = {
    transition: TransitionPointName;
    block_num: number;
    blocks_until: number;
    transitioned: boolean;
    description: string;
}[];

@singleton()
export class TransitionManager implements VirtualPayloadSource {
    public static readonly TRANSITION_ACCOUNT = '$TRANSITIONS';

    get transitionAccount() {
        return TransitionManager.TRANSITION_ACCOUNT;
    }

    get transitionPoints() {
        return this.transitionCfg.transition_points as Readonly<TransitionPoints['transition_points']>;
    }

    constructor(@inject(PrefixOpts) private readonly cfg: PrefixOpts, @inject(TransitionPoints) private readonly transitionCfg: TransitionPoints) {}

    /**
     * Summarizes all transition points
     */
    getTransitionPointsStatusesAtBlock(block_num: number): TransitionPointsStatuses {
        const statuses: TransitionPointsStatuses = [];
        for (const name in this.transitionPoints) {
            const transition_name = name as TransitionPointName;
            const transition_point = this.transitionCfg.transition_points[transition_name] ?? 0;
            const transitioned = transition_point <= block_num;
            const blocks_until = transitioned ? 0 : transition_point - block_num;
            statuses.push({
                transition: transition_name,
                block_num: transition_point,
                blocks_until,
                transitioned,
                description: TransitionPointDescriptions[transition_name],
            });
        }
        // sort descending by block_num
        statuses.sort((a, b) => b.block_num - a.block_num);
        return statuses;
    }

    /**
     * Check if the block number is a transition point for the given name.
     */
    isTransitionPoint(name: TransitionPointName, block_num: number) {
        if (name in this.transitionPoints) {
            return this.transitionCfg.transition_points[name] === block_num;
        }
        return false;
    }

    /**
     * Check if the block number is at or past the transition point for the given name.
     */
    isTransitioned(name: TransitionPointName, block_num: number) {
        if (name in this.transitionPoints) {
            return this.transitionCfg.transition_points[name] <= block_num;
        }
        return false;
    }

    process(block: BlockRef): Promise<ProcessResult[]> {
        // TODO: make a better system for producing these when we get to > 5
        if (this.isTransitionPoint('fix_vote_weight', block.block_num)) {
            return Promise.resolve([
                [
                    'custom_json',
                    {
                        required_auths: [this.transitionAccount],
                        required_posting_auths: [],
                        id: this.cfg.custom_json_id,
                        json: {
                            action: 'transition_fix_vote_weight',
                            params: {
                                block_num: block.block_num,
                            },
                        },
                    },
                ],
            ]);
        } else if (this.isTransitionPoint('validator_transition_cleanup', block.block_num)) {
            // we want two separate ops here because we want to capture the event log for the lite account clean up
            // for record keeping (outside the validator)
            return Promise.resolve([
                [
                    'custom_json',
                    {
                        required_auths: [this.transitionAccount],
                        required_posting_auths: [],
                        id: this.cfg.custom_json_id,
                        json: {
                            action: 'transition_cleanup_lite_accounts',
                            params: {
                                block_num: block.block_num,
                            },
                        },
                    },
                ],
                [
                    'custom_json',
                    {
                        required_auths: [this.transitionAccount],
                        required_posting_auths: [],
                        id: this.cfg.custom_json_id,
                        json: {
                            action: 'transition_balance_token_staking_spsp',
                            params: {
                                block_num: block.block_num,
                            },
                        },
                    },
                ],
            ]);
        }
        return Promise.resolve([]); // No action for other transition points
    }

    trx_id(block: BlockRef): string {
        return `sl_transition_point_${block.block_num}`;
    }
}
