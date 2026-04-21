import {
    AdminMembership,
    BlockRangeConfig,
    DelegationOfferPromiseHandler,
    DelegationPromiseHandler,
    PrefixOpts,
    PromiseHandlerRoute,
    PromiseHandlerRouter,
    PromiseManager,
    PromiseRepository,
} from '@steem-monsters/splinterlands-validator';
import { inject, injectable } from 'tsyringe';
import { TransitionCfg } from '../transition';

function buildRouter(
    delegationPromiseHandler: DelegationPromiseHandler,
    delegationOfferPromiseHandler: DelegationOfferPromiseHandler,
    delegationOfferTransitionBlock: number,
): PromiseHandlerRouter {
    return new PromiseHandlerRouter()
        .addRoute(new PromiseHandlerRoute('delegation', delegationPromiseHandler, new BlockRangeConfig({ to_block: delegationOfferTransitionBlock })))
        .addRoute(new PromiseHandlerRoute('delegation_offer', delegationOfferPromiseHandler, new BlockRangeConfig({ from_block: delegationOfferTransitionBlock })))
        .recompute();
}

@injectable()
export class SpsPromiseManager extends PromiseManager {
    constructor(
        @inject(DelegationPromiseHandler) delegationPromiseHandler: DelegationPromiseHandler,
        @inject(DelegationOfferPromiseHandler) delegationOfferPromiseHandler: DelegationOfferPromiseHandler,
        @inject(PrefixOpts) prefixOpts: PrefixOpts,
        @inject(AdminMembership) adminMembership: AdminMembership,
        @inject(PromiseRepository) promiseRepository: PromiseRepository,
        @inject(TransitionCfg) transitionCfg: TransitionCfg,
    ) {
        super(
            buildRouter(delegationPromiseHandler, delegationOfferPromiseHandler, transitionCfg.transition_points.delegation_offer_block),
            prefixOpts,
            adminMembership,
            promiseRepository,
        );
    }
}
