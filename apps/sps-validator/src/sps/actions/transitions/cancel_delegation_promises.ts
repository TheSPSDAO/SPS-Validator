import { OperationData, Action, EventLog, Trx, PromiseRepository } from '@steem-monsters/splinterlands-validator';
import { transition_cancel_delegation_promises } from '../schema';
import { MakeActionFactory, MakeRouter } from '../utils';
import { TransitionManager } from '../../features/transition';

const DELEGATION_PROMISE_TYPE = 'delegation';

export class CancelDelegationPromisesTransitionAction extends Action<typeof transition_cancel_delegation_promises.actionSchema> {
    constructor(op: OperationData, data: unknown, index: number, private readonly promiseRepository: PromiseRepository, private readonly transitionManager: TransitionManager) {
        super(transition_cancel_delegation_promises, op, data, index);
    }

    override isSupported(): boolean {
        return this.op.account === this.transitionManager.transitionAccount && this.transitionManager.isTransitionPoint('delegation_offer_block', this.op.block_num);
    }

    async validate() {
        return true;
    }

    async process(trx?: Trx): Promise<EventLog[]> {
        const events: EventLog[] = [];

        // Get all open delegation promises (fulfilled ones will complete normally)
        const promises = await this.promiseRepository.getOpenPromisesByType(DELEGATION_PROMISE_TYPE, trx);

        for (const promise of promises) {
            // Update the promise status to cancelled
            const [, updateLogs] = await this.promiseRepository.update(
                {
                    action: 'cancel',
                    previous_status: promise.status,
                    actor: this.transitionManager.transitionAccount,
                    type: promise.type,
                    ext_id: promise.ext_id,
                    status: 'cancelled',
                    fulfilled_at: null,
                    fulfilled_by: null,
                    fulfilled_expiration: null,
                },
                this,
                trx,
            );
            events.push(...updateLogs);
        }

        return events;
    }
}

const Builder = MakeActionFactory(CancelDelegationPromisesTransitionAction, PromiseRepository, TransitionManager);
export const Router = MakeRouter(transition_cancel_delegation_promises.action_name, Builder);
