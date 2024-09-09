import { AdminMembership, DelegationPromiseHandler, PrefixOpts, PromiseHandler, PromiseManager, PromiseRepository } from '@steem-monsters/splinterlands-validator';
import { inject, injectable } from 'tsyringe';

function buildHandlerMap(delegationPromiseHandler: DelegationPromiseHandler): Map<string, PromiseHandler> {
    const handlerMap = new Map<string, PromiseHandler>();
    handlerMap.set('delegation', delegationPromiseHandler);
    return handlerMap;
}

@injectable()
export class SpsPromiseManager extends PromiseManager {
    constructor(
        @inject(DelegationPromiseHandler) delegationPromiseHandler: DelegationPromiseHandler,
        @inject(PrefixOpts) prefixOpts: PrefixOpts,
        @inject(AdminMembership) adminMembership: AdminMembership,
        @inject(PromiseRepository) promiseRepository: PromiseRepository,
    ) {
        super(buildHandlerMap(delegationPromiseHandler), prefixOpts, adminMembership, promiseRepository);
    }
}
