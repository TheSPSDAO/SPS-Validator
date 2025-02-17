import {
    BlockProcessor,
    BlockRepository,
    HiveAccountRepository,
    HiveClient,
    LastBlockCache,
    OperationFactory,
    PrefixOpts,
    TopLevelVirtualPayloadSource,
    TransactionStarter,
    ValidatorOpts,
    ValidatorRepository,
    ValidatorWatch,
} from '@steem-monsters/splinterlands-validator';
import { inject, injectable } from 'tsyringe';
import { SpsSynchronisationClosure, SpsSynchronisationConfig } from './sync';

@injectable()
export class SpsBlockProcessor extends BlockProcessor<SpsSynchronisationConfig> {
    public constructor(
        @inject(TransactionStarter) trxStarter: TransactionStarter,
        @inject(TopLevelVirtualPayloadSource) topLevelVirtualPayloadSource: TopLevelVirtualPayloadSource,
        @inject(BlockRepository) blockRepository: BlockRepository,
        @inject(OperationFactory) operationFactory: OperationFactory,
        @inject(ValidatorRepository) validatorRepository: ValidatorRepository,
        @inject(PrefixOpts) prefix: PrefixOpts,
        @inject(ValidatorOpts) validatorOpts: ValidatorOpts,
        @inject(ValidatorWatch) watcher: ValidatorWatch,
        @inject(HiveAccountRepository) hiveAccountRepository: HiveAccountRepository,
        @inject(HiveClient) hive: HiveClient,
        @inject(LastBlockCache) lastBlockCache: LastBlockCache,
        @inject(SpsSynchronisationClosure) sync: SpsSynchronisationClosure,
    ) {
        super(
            trxStarter,
            topLevelVirtualPayloadSource,
            blockRepository,
            operationFactory,
            validatorRepository,
            prefix,
            validatorOpts,
            watcher,
            hiveAccountRepository,
            hive,
            lastBlockCache,
            sync,
            // helper to map price feed in qa environments. when we switch over to network block validation
            // this can be removed.
            new Map([['sm_price_feed', 'price_feed']]),
        );
    }
}
