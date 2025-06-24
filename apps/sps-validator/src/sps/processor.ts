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
import { NBlock } from 'validator/src/entities/block';
import { TransitionManager } from './features/transition';

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
        @inject(TransitionManager) private readonly transitionManager: TransitionManager,
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

    // Override the process method if you need to add custom logic for SPS processing
    protected override transformBlock(block: NBlock): NBlock {
        // Custom transformation logic for SPS blocks can be added here
        // For now, we just call the parent method
        if (this.transitionManager.isTransitionPoint('bad_block_96950550', block.block_num)) {
            // Skip transactions in block 96950550 due to a hive node microfork that the splinterlands node read.
            // This is a one-time transition point that is part of version 1.1.3 to support replaying from initial snapshot.
            return new NBlock(
                block.block_num,
                {
                    timestamp: '2025-06-20T15:36:51.000',
                    transactions: [],
                    transaction_ids: [],
                    block_id: block.block_id,
                    previous: block.previous,
                },
                { l2_block_id: block.prev_block_hash }, // previous block's l2_block_id
            );
        }
        return super.transformBlock(block);
    }
}
