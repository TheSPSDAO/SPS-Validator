import { DelegationManager, DelegationPromiseHandler, DelgationPromiseHandlerOpts } from '@steem-monsters/splinterlands-validator';
import { inject, injectable } from 'tsyringe';

const DELEGATION_PROMISE_HANDLER_OPTS: DelgationPromiseHandlerOpts = {
    delegation_promise_account: '$DELEGATION_PROMISES',
};

@injectable()
export class SpsDelegationPromiseHandler extends DelegationPromiseHandler {
    constructor(@inject(DelegationManager) delegationManager: DelegationManager) {
        super(DELEGATION_PROMISE_HANDLER_OPTS, delegationManager);
    }
}
