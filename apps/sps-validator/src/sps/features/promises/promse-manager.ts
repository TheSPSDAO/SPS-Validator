import {
    AdminMembership,
    DelegationOfferPromiseHandler,
    DelegationPromiseHandler,
    PrefixOpts,
    PromiseHandler,
    PromiseManager,
    PromiseRepository,
} from '@steem-monsters/splinterlands-validator';
import { inject, injectable } from 'tsyringe';

function buildHandlerMap(delegationPromiseHandler: DelegationPromiseHandler, delegationOfferPromiseHandler: DelegationOfferPromiseHandler): Map<string, PromiseHandler> {
    const handlerMap = new Map<string, PromiseHandler>();
    handlerMap.set('delegation', delegationPromiseHandler);
    handlerMap.set('delegation_offer', delegationOfferPromiseHandler);
    return handlerMap;
}

@injectable()
export class SpsPromiseManager extends PromiseManager {
    constructor(
        @inject(DelegationPromiseHandler) delegationPromiseHandler: DelegationPromiseHandler,
        @inject(DelegationOfferPromiseHandler) delegationOfferPromiseHandler: DelegationOfferPromiseHandler,
        @inject(PrefixOpts) prefixOpts: PrefixOpts,
        @inject(AdminMembership) adminMembership: AdminMembership,
        @inject(PromiseRepository) promiseRepository: PromiseRepository,
    ) {
        super(buildHandlerMap(delegationPromiseHandler, delegationOfferPromiseHandler), prefixOpts, adminMembership, promiseRepository);
    }
}
