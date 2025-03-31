import { BlockRef, PrefixOpts, ProcessResult, VirtualPayloadSource } from '@steem-monsters/splinterlands-validator';
import { inject, singleton } from 'tsyringe';

export type TransitionPoints = {
    transition_points: {
        fix_vote_weight: number;
    };
};
export const TransitionPoints: unique symbol = Symbol('TransitionPoints');
export type TransitionPointName = keyof TransitionPoints['transition_points'];

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
        // Produce the vop for fixing vote weights if we are at the transition point
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
        }
        return Promise.resolve([]);
    }

    trx_id(block: BlockRef): string {
        return `sl_transition_point_${block.block_num}`;
    }
}
