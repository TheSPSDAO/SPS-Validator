import { Result } from '@steem-monsters/lib-monad';
import { OperationData, PromiseManager, AdminMembership, AdminAction, EventLog, Trx } from '@steem-monsters/splinterlands-validator';
import { create_promise } from '../schema';
import { MakeActionFactory, MakeRouter } from '../utils';

export class CreatePromiseAction extends AdminAction<typeof create_promise.actionSchema> {
    constructor(op: OperationData, data: unknown, index: number, private readonly promiseManager: PromiseManager, adminMembership: AdminMembership) {
        super(adminMembership, create_promise, op, data, index);
    }

    override async validate(trx?: Trx | undefined): Promise<boolean> {
        if (!(await super.validate(trx))) {
            return false;
        }

        const validateResult = await this.promiseManager.validateCreatePromise(
            {
                type: this.params.type,
                id: this.params.id,
                controllers: this.params.controllers,
                params: this.params.params,
                fulfill_timeout_seconds: this.params.fulfill_timeout_seconds,
            },
            this,
            trx,
        );

        if (Result.isErr(validateResult)) {
            throw validateResult.error;
        }

        return true;
    }

    async process(trx?: Trx): Promise<EventLog[]> {
        return this.promiseManager.createPromise(
            {
                type: this.params.type,
                id: this.params.id,
                controllers: this.params.controllers,
                params: this.params.params,
                fulfill_timeout_seconds: this.params.fulfill_timeout_seconds,
            },
            this,
            trx,
        );
    }
}

const Builder = MakeActionFactory(CreatePromiseAction, PromiseManager, AdminMembership);
export const Router = MakeRouter(create_promise.action_name, Builder);
