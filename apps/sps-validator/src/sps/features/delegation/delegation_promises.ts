import { DelegationManager, DelegationPromiseHandler, DelgationPromiseHandlerOpts } from '@steem-monsters/splinterlands-validator';
import { inject, injectable } from 'tsyringe';

@injectable()
export class SpsDelegationPromiseHandler extends DelegationPromiseHandler {
    constructor(@inject(DelegationManager) delegationManager: DelegationManager) {
        const opts: DelgationPromiseHandlerOpts = {
            delegation_promise_account: '$DELEGATION_PROMISES',
        };
        super(opts, delegationManager);
    }
}
