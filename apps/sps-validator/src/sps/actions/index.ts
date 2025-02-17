import { inject, singleton } from 'tsyringe';
import { LookupWrapper, PoolClaimPayloads, PromiseManager, TokenUnstakingRepository, ValidatorWatch } from '@steem-monsters/splinterlands-validator';
import { Router as ConfigUpdateRouter } from './config_update';
import { Router as TestActionRouter } from './test_action';
import { Router as TokenTransferRouter } from './tokens/token_transfer';
import { Router as DelegateTokensRouter } from './tokens/delegate_tokens';
import { Router as UndelegateTokensRouter } from './tokens/undelegate_tokens';
import { Router as UndelegateTokensMultiRouter } from './tokens/undelegate_tokens_multi';
import { Router as ReturnTokensRouter } from './tokens/return_tokens';
import { Router as StakeTokensRouter } from './tokens/stake_tokens';
import { Router as StakeTokensMultiRouter } from './tokens/stake_tokens_multi';
import { Router as CancelUnstakeTokensRouter } from './tokens/cancel_unstake_tokens';
import { Router as ApproveValidatorRouter } from './validator/approve_validator';
import { Router as UnstakeTokensRouter } from './tokens/unstake_tokens';
import { Router as ClaimStakingRewardsRouter } from './tokens/claim_staking_rewards';
import { Router as UnapproveValidatorRouter } from './validator/unapprove_validator';
import { Router as ValidateBlockRouter } from './validator/validate_block';
import { Router as UpdateValidatorRouter } from './validator/update_validator';
import { Router as TokenAwardRouter } from './tokens/token_award';
import { Router as PriceFeedRouter } from './validator/price_feed';
import { Router as ActivateLicenseRouter } from './validator/activate_license';
import { Router as DeactivateLicenseRouter } from './validator/deactivate_license';
import { Router as ExpireCheckInsRouter } from './validator/expire_check_ins';
import { Router as CheckInValidatorRouter } from './validator/check_in_validator';
import { Router as TokenTransferMultiRouter } from './tokens/token_transfer_multi';
import { Router as ShopPurchaseRouter } from './tokens/shop_purchase';
import { Router as AddPoolRouter } from './pools/add';
import { Router as UpdatePoolRouter } from './pools/update';
import { Router as DisablePoolRouter } from './pools/disable';
import { Router as TokenUnstakingRouter } from './tokens/token_unstaking';
import { Router as ClaimPoolRouter } from './pools/claim';
import { Router as BurnRouter } from './tokens/burn';
import { Router as SetAuthorityRouter } from './account/set_authority';
import { Router as CreatePromiseRouter } from './promises/create_promise';
import { Router as FulfillPromiseRouter } from './promises/fulfill_promise';
import { Router as FulfillPromisesRouter } from './promises/fulfill_promises';
import { Router as ReversePromiseRouter } from './promises/reverse_promise';
import { Router as CancelPromiseRouter } from './promises/cancel_promise';
import { Router as CompletePromiseRouter } from './promises/complete_promise';
import { Router as ExpirePromisesRouter } from './promises/expire_promises';
import { Router as UpdateMissedBlocksRouter } from './validator/update_missed_blocks';
import { MakeMultiRouter, MakeVirtualPayloadSource } from './utils';
import { SpsValidatorLicenseManager } from '../features/validator';
import { SpsClearBurnedTokensSource } from './burn';
import { SpsUpdateMissedBlocksSource } from './missed_blocks';

export const RouterImpl = MakeMultiRouter(
    TestActionRouter,
    TokenTransferRouter,
    DelegateTokensRouter,
    UndelegateTokensRouter,
    UndelegateTokensMultiRouter,
    ReturnTokensRouter,
    StakeTokensRouter,
    StakeTokensMultiRouter,
    CancelUnstakeTokensRouter,
    ApproveValidatorRouter,
    UnstakeTokensRouter,
    ClaimStakingRewardsRouter,
    UnapproveValidatorRouter,
    ValidateBlockRouter,
    ConfigUpdateRouter,
    UpdateValidatorRouter,
    TokenAwardRouter,
    PriceFeedRouter,
    TokenTransferMultiRouter,
    ShopPurchaseRouter,
    AddPoolRouter,
    UpdatePoolRouter,
    DisablePoolRouter,
    SetAuthorityRouter,
    CreatePromiseRouter,
    FulfillPromiseRouter,
    FulfillPromisesRouter,
    ReversePromiseRouter,
    CancelPromiseRouter,
    CompletePromiseRouter,
    ActivateLicenseRouter,
    DeactivateLicenseRouter,
    CheckInValidatorRouter,
);
export type RouterImpl = InstanceType<typeof RouterImpl>;

export const VirtualRouterImpl = MakeMultiRouter(TokenUnstakingRouter, ClaimPoolRouter, BurnRouter, ExpirePromisesRouter, ExpireCheckInsRouter, UpdateMissedBlocksRouter);
export type VirtualRouterImpl = InstanceType<typeof VirtualRouterImpl>;

export const VirtualPayloadSource = MakeVirtualPayloadSource(
    TokenUnstakingRepository,
    PoolClaimPayloads,
    SpsClearBurnedTokensSource,
    PromiseManager,
    SpsValidatorLicenseManager,
    SpsUpdateMissedBlocksSource,
);
export type VirtualPayloadSource = InstanceType<typeof VirtualPayloadSource>;

@singleton()
export class SpsLookupWrapper extends LookupWrapper {
    constructor(@inject(RouterImpl) router: RouterImpl, @inject(VirtualRouterImpl) virtualRouter: VirtualRouterImpl, @inject(ValidatorWatch) watcher: ValidatorWatch) {
        super(router, virtualRouter, watcher);
    }
}
