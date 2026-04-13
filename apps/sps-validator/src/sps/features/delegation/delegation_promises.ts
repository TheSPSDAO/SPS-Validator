import { DelegationManager, DelegationPromiseHandler, DelgationPromiseHandlerOpts } from '@steem-monsters/splinterlands-validator';
import { inject, injectable } from 'tsyringe';
import { TransitionCfg } from '../transition';

@injectable()
export class SpsDelegationPromiseHandler extends DelegationPromiseHandler {
    constructor(@inject(DelegationManager) delegationManager: DelegationManager, @inject(TransitionCfg) transitionCfg: TransitionCfg) {
        const opts: DelgationPromiseHandlerOpts = {
            delegation_promise_account: '$DELEGATION_PROMISES',
            delegation_offer_transition_block: transitionCfg.transition_points.delegation_offer_block,
        };
        super(opts, delegationManager);
    }
}
