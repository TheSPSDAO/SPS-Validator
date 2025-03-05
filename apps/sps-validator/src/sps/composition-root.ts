import { container, DependencyContainer, InjectionToken, instanceCachingFactory, TokenProvider } from 'tsyringe';
import { Knex } from 'knex';
import cfg, { ConfigType } from './convict-config';
import { SpsConfigLoader } from './config';
import { Client } from 'splinterlands-dhive-sl';
import { SpsBlockProcessor } from './processor';
import { ConfiguredSynchronisationPoint, SpsSynchronisationConfig, StartupSync } from './sync';
import { DefaultMiddleware, EnabledApiActivator, SnapshotMiddleware, UnmanagedCacheMiddleware } from './api';
import { SpsSnapshot, SpsUnmanagedSnapshot } from './snapshot';
import { RouterImpl, SpsLookupWrapper, VirtualPayloadSource, VirtualRouterImpl } from './actions';
import { BurnOpts, SpsClearBurnedTokensSource } from './actions/burn';
import { SpsPrimer } from './primer';
import { SpsDelayedSocket, SpsSocketWrapper } from './socket';
import { TypedKnex } from '@wwwouter/typed-knex';
import { SpsEntryPoint } from './entry-point';
import { SpsActionOrBust, SpsOperationFactory } from './entities/operation';
import { SpsBlockRepository, SpsHiveAccountRepository, SpsLastBlockCache, SpsTransactionRepository } from './entities/block';
import { SpsPoolClaimPayloads } from './entities/claims';
import { SpsStakingRewardsRepository } from './entities/tokens/staking_rewards';
import { SpsBalanceRepository, SupplyOpts } from './entities/tokens/balance';
import { SpsTokenUnstakingRepository } from './entities/tokens/token_unstaking';
import { SpsValidatorVoteRepository, SpsVoteWeightCalculator } from './entities/validator/validator_vote';
import { SpsValidatorRepository } from './entities/validator/validator';
import { SpsBalanceHistoryRepository } from './entities/tokens/balance_history';
import { SpsActiveDelegationsRepository } from './entities/tokens/active_delegations';
import { SpsPromiseRepository } from './entities/promises/promise';
import { SpsHiveStream } from './hive-stream';
import { SpsValidatorShop } from './validator-shop';
import { SpsPoolManager } from './pool-manager';
import { SpsHiveClient } from './hive';
import { SpsBookkeeping } from './bookkeeping';
import { SpsDelegationManager, SpsDelegationPromiseHandler } from './features/delegation';
import { SpsPromiseManager } from './features/promises';
import {
    ActionOrBust,
    ApiOptions,
    BalanceHistoryRepository,
    BalanceRepository,
    BlockProcessor,
    BlockRepository,
    ConditionalApiActivator,
    ConfigLoader,
    ConfigRepository,
    DelayedSocket,
    EntryOptions,
    EntryPoint,
    freshKnex,
    Handle,
    HiveAccountRepository,
    HiveClient,
    HiveOptions,
    HiveStream,
    HiveStreamOptions,
    KnexToken,
    LastBlockCache,
    LookupWrapper,
    Middleware,
    OperationFactory,
    PluginDispatcher,
    PoolClaimPayloads,
    PoolManager,
    PrefixOpts,
    PriceCalculator,
    PriceFeedConsumer,
    PriceFeedProducer,
    PriceHistoryRepository,
    Primer,
    RawPriceFeed,
    Resolver,
    ShopWatch,
    Snapshot,
    SocketLike,
    SocketOptions,
    SocketWrapper,
    TokenWatch,
    StakingRewardsRepository,
    TokenUnstakingRepository,
    TopActionRouter,
    TopLevelVirtualPayloadSource,
    TopPriceFeedWrapper,
    TransactionRepository,
    TransactionRepository_,
    TransactionStarter,
    UnmanagedSnapshot,
    ValidatorOpts,
    ValidatorRepository,
    ValidatorVoteHistoryRepository,
    ValidatorVoteRepository,
    ValidatorWatch,
    VirtualActionRouter,
    VoteWeightCalculator,
    MedianPriceCalculator,
    DisabledApiActivator,
    PluginDispatcherBuilder,
    AdminMembership,
    PoolWatch,
    Pools,
    PoolsHelper,
    Shop,
    Trx,
    PoolUpdater,
    ActiveDelegationsRepository,
    PoolSerializer,
    StakingConfiguration,
    UnstakingWatch,
    Bookkeeping,
    BookkeepingWatch,
    DelegationManager,
    PromiseManager,
    DelegationPromiseHandler,
    PromiseRepository,
    ValidatorUpdater,
} from '@steem-monsters/splinterlands-validator';
import { ValidatorPools } from './pools';
import { ValidatorShop } from './utilities/validator-shop';
import { KillPlugin } from '../plugins/kill_plugin';
import { ManualDisposer } from './manual-disposable';
import { SpsValidatorLicenseManager, ValidatorCheckInPlugin, ValidatorCheckInWatch } from './features/validator';
import { MissedBlocksOpts, SpsUpdateMissedBlocksSource } from './actions/missed_blocks';
import {
    CoinGeckoExternalPriceFeed,
    CoinGeckoExternalPriceFeedOpts,
    CoinMarketCapExternalPriceFeed,
    CoinMarketCapExternalPriceFeedOpts,
    DaoExternalPriceFeed,
    DaoExternalPriceFeedOpts,
    ExternalPriceFeed,
    PriceFeedPlugin,
    PriceFeedWatch,
    SpsPriceFeed,
    SpsTopPriceFeedWrapper,
} from './features/price_feed';
import { SpsValidatorCheckInRepository } from './entities/validator/validator_check_in';
import { SpsBscRepository, SpsEthRepository } from './entities/tokens/eth';
import { HiveEngineRepository } from './entities/tokens/hive_engine';

// Only use re-exported `container` to ensure composition root was loaded.
export { container, singleton, inject, injectable } from 'tsyringe';

export class CompositionRoot extends null {
    static {
        // Register self
        container.register<Resolver>(Resolver, { useValue: container });

        // Database
        container.register<Knex>(KnexToken, {
            useFactory: instanceCachingFactory((c) => {
                const cfg = c.resolve<ConfigType>(ConfigType);
                return freshKnex(cfg);
            }),
        });
        container.register<Handle>(Handle, {
            useFactory: (c) => {
                const knex = c.resolve<Knex>(KnexToken);
                const typedKnex = new TypedKnex(knex) as Handle;
                typedKnex.knexInstance = knex;
                return typedKnex;
            },
        });
        container.register<TransactionStarter>(TransactionStarter, {
            useFactory: (c) => {
                const knex = c.resolve<Knex>(KnexToken);
                return new TransactionStarter(knex);
            },
        });

        // Configurations
        container.register<ConfigType>(ConfigType, { useValue: cfg });
        container.register<EntryOptions>(EntryOptions, { useToken: ConfigType });
        container.register<PrefixOpts>(PrefixOpts, { useToken: ConfigType });
        container.register<ApiOptions>(ApiOptions, { useToken: ConfigType });
        container.register<ValidatorOpts>(ValidatorOpts, { useToken: ConfigType });
        container.register<SocketOptions>(SocketOptions, { useToken: ConfigType });
        container.register<HiveStreamOptions>(HiveStreamOptions, { useToken: ConfigType });
        container.register<HiveOptions>(HiveOptions, { useToken: ConfigType });
        container.register<BurnOpts>(BurnOpts, { useToken: ConfigType });
        container.register<MissedBlocksOpts>(MissedBlocksOpts, { useToken: ConfigType });
        container.register<StakingConfiguration>(StakingConfiguration, { useToken: ConfigType });
        container.register<SupplyOpts>(SupplyOpts, { useToken: ConfigType });

        // Hive
        container.register<HiveClient>(HiveClient, { useToken: SpsHiveClient });
        container.register<Client>(Client, { useToken: HiveClient });
        container.register<HiveStream>(HiveStream, { useToken: SpsHiveStream });

        // External Chains
        container.registerInstance(SpsEthRepository, new SpsEthRepository(cfg.eth));
        container.registerInstance(SpsBscRepository, new SpsBscRepository(cfg.bsc));
        container.registerSingleton(HiveEngineRepository);

        // Socket
        container.register<SocketWrapper>(SocketWrapper, { useToken: SpsSocketWrapper });
        container.register<DelayedSocket>(DelayedSocket, { useToken: SpsDelayedSocket });
        container.register<SocketLike>(SocketLike, { useToken: SpsDelayedSocket });

        // Price feed
        container.register<RawPriceFeed>(RawPriceFeed, { useToken: SpsPriceFeed });
        container.register<TopPriceFeedWrapper>(TopPriceFeedWrapper, { useToken: SpsTopPriceFeedWrapper });
        container.register<PriceFeedConsumer>(PriceFeedConsumer, { useToken: RawPriceFeed });
        container.register<PriceFeedProducer>(PriceFeedProducer, { useToken: RawPriceFeed });
        container.register<PriceCalculator>(PriceCalculator, { useValue: new MedianPriceCalculator() });

        // Token pool related stuff
        container.register<Pools>(Pools, { useValue: ValidatorPools });
        container.register<PoolsHelper<string>>(PoolsHelper, {
            useFactory: (c) => {
                const pools = c.resolve<Pools>(Pools);
                return new PoolsHelper<string>(pools);
            },
        });

        // Data lifecycle management
        container.register<Primer>(Primer, { useToken: SpsPrimer });
        container.register<Snapshot<DependencyContainer>>(Snapshot, { useToken: SpsSnapshot });
        container.register<UnmanagedSnapshot<DependencyContainer>>(UnmanagedSnapshot, { useToken: SpsUnmanagedSnapshot });
        container.register(ManualDisposer, { useClass: ManualDisposer });

        // API
        container.register<ConditionalApiActivator>(ConditionalApiActivator, {
            useFactory: instanceCachingFactory((c) => {
                const cfg = c.resolve<ConfigType>(ConfigType);
                if (cfg.api_port) {
                    return c.resolve<EnabledApiActivator>(EnabledApiActivator);
                } else {
                    return c.resolve<DisabledApiActivator>(DisabledApiActivator);
                }
            }),
        });
        container.register<Middleware>(Middleware, {
            useFactory: instanceCachingFactory((c) => {
                const cfg = c.resolve<ConfigType>(ConfigType);
                if (cfg.api_port) {
                    if (cfg.block_processing) {
                        return c.resolve<Middleware>(SnapshotMiddleware);
                    } else {
                        return c.resolve<Middleware>(UnmanagedCacheMiddleware);
                    }
                    // TODO: Should never happen for actual deployments, as currently api is controlled by cfg.api_port
                    // It might still be needed for tests that may not set up cfg correctly.
                } else {
                    return c.resolve<Middleware>(DefaultMiddleware);
                }
            }),
        });
        container.register<ConfiguredSynchronisationPoint>(ConfiguredSynchronisationPoint, { useToken: StartupSync });
        container.register<BlockProcessor<SpsSynchronisationConfig>>(BlockProcessor, { useToken: SpsBlockProcessor });

        // Configuration Loader
        container.register<ConfigLoader>(ConfigLoader, { useToken: SpsConfigLoader });
        container.register<ValidatorWatch>(ValidatorWatch, { useToken: SpsConfigLoader });
        container.register<TokenWatch>(TokenWatch, { useToken: SpsConfigLoader });
        container.register<UnstakingWatch>(UnstakingWatch, { useToken: SpsConfigLoader });
        container.register<PoolWatch>(PoolWatch, { useToken: SpsConfigLoader });
        container.register<ShopWatch>(ShopWatch, { useToken: SpsConfigLoader });
        container.register<BookkeepingWatch>(BookkeepingWatch, { useToken: SpsConfigLoader });
        container.register<PriceFeedWatch>(PriceFeedWatch, { useToken: SpsConfigLoader });
        container.register(ValidatorCheckInWatch, { useToken: SpsConfigLoader });
        container.register<AdminMembership>(AdminMembership, { useToken: SpsConfigLoader });
        container.register<PoolUpdater>(PoolUpdater, { useToken: SpsConfigLoader });
        container.register<PoolSerializer>(PoolSerializer, { useToken: SpsConfigLoader });
        container.register<ValidatorUpdater>(ValidatorUpdater, { useToken: SpsConfigLoader });

        // Action construction
        container.register(SpsUpdateMissedBlocksSource, { useClass: SpsUpdateMissedBlocksSource });
        container.register(SpsClearBurnedTokensSource, { useClass: SpsClearBurnedTokensSource });
        container.register<TopLevelVirtualPayloadSource>(TopLevelVirtualPayloadSource, { useToken: VirtualPayloadSource });
        container.register<TopActionRouter>(TopActionRouter, { useToken: RouterImpl });
        container.register<VirtualActionRouter>(VirtualActionRouter, { useToken: VirtualRouterImpl });
        container.register<LookupWrapper>(LookupWrapper, { useToken: SpsLookupWrapper });
        container.register<ActionOrBust>(ActionOrBust, { useToken: SpsActionOrBust });
        container.register<OperationFactory>(OperationFactory, { useToken: SpsOperationFactory });
        container.register<PoolClaimPayloads>(PoolClaimPayloads, { useToken: SpsPoolClaimPayloads });

        // Repositories
        container.register<ConfigRepository>(ConfigRepository, {
            useFactory: (c) => {
                const handle = c.resolve<Handle>(Handle);
                return new ConfigRepository(handle);
            },
        });
        container.register<PriceHistoryRepository>(PriceHistoryRepository, {
            useFactory: (c) => {
                const handle = c.resolve<Handle>(Handle);
                return new PriceHistoryRepository(handle);
            },
        });
        container.register<ValidatorVoteHistoryRepository>(ValidatorVoteHistoryRepository, {
            useFactory: (c) => {
                const handle = c.resolve<Handle>(Handle);
                return new ValidatorVoteHistoryRepository(handle);
            },
        });
        container.register<TransactionRepository_>(TransactionRepository_, {
            useFactory: (c) => {
                const handle = c.resolve<Handle>(Handle);
                return new TransactionRepository_(handle);
            },
        });
        container.register<TransactionRepository>(TransactionRepository, { useToken: SpsTransactionRepository });
        container.register<BlockRepository>(BlockRepository, { useToken: SpsBlockRepository });
        container.register<ActiveDelegationsRepository>(ActiveDelegationsRepository, { useToken: SpsActiveDelegationsRepository });
        container.register<BalanceRepository>(BalanceRepository, { useToken: SpsBalanceRepository });
        container.register<BalanceHistoryRepository>(BalanceHistoryRepository, { useToken: SpsBalanceHistoryRepository });
        container.register<HiveAccountRepository>(HiveAccountRepository, { useToken: SpsHiveAccountRepository });
        container.register<StakingRewardsRepository>(StakingRewardsRepository, { useToken: SpsStakingRewardsRepository });
        container.register<TokenUnstakingRepository>(TokenUnstakingRepository, { useToken: SpsTokenUnstakingRepository });
        container.register<ValidatorVoteRepository>(ValidatorVoteRepository, { useToken: SpsValidatorVoteRepository });
        container.register<ValidatorRepository>(ValidatorRepository, { useToken: SpsValidatorRepository });
        container.register<PromiseRepository>(PromiseRepository, { useToken: SpsPromiseRepository });
        container.register(SpsValidatorCheckInRepository, { useClass: SpsValidatorCheckInRepository });

        // Assorted other things
        container.register<VoteWeightCalculator>(VoteWeightCalculator, { useToken: SpsVoteWeightCalculator });
        container.register<ValidatorShop>(ValidatorShop, { useToken: SpsValidatorShop });
        container.register<Shop<Trx>>(Shop, { useToken: ValidatorShop });
        container.register<PoolManager>(PoolManager, { useToken: SpsPoolManager });
        container.register<LastBlockCache>(LastBlockCache, { useToken: SpsLastBlockCache });
        container.register<Bookkeeping>(Bookkeeping, { useToken: SpsBookkeeping });
        container.register<DelegationManager>(DelegationManager, { useToken: SpsDelegationManager });
        container.register<PromiseManager>(PromiseManager, { useToken: SpsPromiseManager });
        container.register(SpsValidatorLicenseManager, { useClass: SpsValidatorLicenseManager });

        // Promise handlers
        container.register<DelegationPromiseHandler>(DelegationPromiseHandler, { useToken: SpsDelegationPromiseHandler });

        // External price feeds
        const daoFeedConfig = cfg.price_feed_dao;
        if (DaoExternalPriceFeed.isAvailable(daoFeedConfig)) {
            container.register<DaoExternalPriceFeedOpts>(DaoExternalPriceFeedOpts, { useValue: daoFeedConfig });
            container.register<ExternalPriceFeed>(ExternalPriceFeed, { useClass: DaoExternalPriceFeed });
        }
        const coinGeckoFeedConfig = cfg.price_feed_coin_gecko;
        if (CoinGeckoExternalPriceFeed.isAvailable(coinGeckoFeedConfig)) {
            container.register<CoinGeckoExternalPriceFeedOpts>(CoinGeckoExternalPriceFeedOpts, { useValue: coinGeckoFeedConfig });
            container.register<ExternalPriceFeed>(ExternalPriceFeed, { useClass: CoinGeckoExternalPriceFeed });
        }
        const cmcFeedConfig = cfg.price_feed_coin_market_cap;
        if (CoinMarketCapExternalPriceFeed.isAvailable(cmcFeedConfig)) {
            container.register<CoinMarketCapExternalPriceFeedOpts>(CoinMarketCapExternalPriceFeedOpts, { useValue: cmcFeedConfig });
            container.register<ExternalPriceFeed>(ExternalPriceFeed, { useClass: CoinMarketCapExternalPriceFeed });
        }

        // Plugins
        container.register(ValidatorCheckInPlugin, { useClass: ValidatorCheckInPlugin });
        container.register<PluginDispatcher>(PluginDispatcher, {
            useFactory: (container) => {
                let builder = PluginDispatcherBuilder.create();

                if (KillPlugin.isAvailable()) {
                    builder = builder.addPlugin(new KillPlugin());
                }

                if (ValidatorCheckInPlugin.isAvailable()) {
                    builder = builder.addPlugin(container.resolve(ValidatorCheckInPlugin));
                }

                const externalFeeds = container.resolveAll(ExternalPriceFeed);
                if (PriceFeedPlugin.isAvailable() && externalFeeds.length > 0) {
                    builder = builder.addPlugin(container.resolve(PriceFeedPlugin));
                }

                return builder.build();
            },
        });

        // EntryPoint
        container.register<EntryPoint<DependencyContainer, SpsSynchronisationConfig>>(EntryPoint, { useToken: SpsEntryPoint });
    }

    static assertValidRegistry(checkContainer = container) {
        try {
            checkContainer.resolve(undefined as unknown as symbol);
        } catch (_) {
            // We expect undefined to not have a registered entry in the DI container.
            return;
        }
        throw new Error(`The DI container has an entry for undefined: Note that cyclic module dependencies may lead to imported consts actually being undefined at runtime. `);
    }

    static replace<T>(token: InjectionToken<T>, provider: TokenProvider<T>, _container = container) {
        // Depends on unmerged PR: https://github.com/microsoft/tsyringe/pull/190
        // HACK: this makes the containers even more stateful, which is not a good thing.
        (_container as any)._registry._registryMap.delete(token);
        _container.register(token, provider);
    }
}
