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
    NBlock,
    BalanceRepository,
} from '@steem-monsters/splinterlands-validator';
import { inject, injectable } from 'tsyringe';
import { SpsSynchronisationClosure, SpsSynchronisationConfig } from './sync';
import { TransitionManager } from './features/transition';
import { VALIDATE_BLOCK_REWARD_ACCOUNT } from './actions/validator/validate_block';

@injectable()
export class SpsBlockProcessor extends BlockProcessor<SpsSynchronisationConfig> {
    public get validateBlockRewardAccount(): string | null {
        return VALIDATE_BLOCK_REWARD_ACCOUNT;
    }

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
        @inject(BalanceRepository) balanceRepository: BalanceRepository,
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
            balanceRepository,
            hive,
            lastBlockCache,
            sync,
            // helper to map price feed in qa environments. when we switch over to network block validation
            // this can be removed.
            new Map([['sm_price_feed', 'price_feed']]),
        );
    }

    protected override transformBlock(block: NBlock): NBlock {
        if (this.transitionManager.isTransitionPoint('bad_block_96950550', block.block_num)) {
            // Skip transactions in block 96950550 due to a hive node microfork that the splinterlands node read.
            // This is a one-time transition point that is part of version 1.1.3 to support replaying from initial snapshot.
            return new NBlock(
                block.block_num,
                {
                    timestamp: '2025-06-20T15:36:51.000',
                    transactions: [],
                    transaction_ids: [],
                    block_id: '05c7591683e0102605a769a6935275a5e760353c',
                    previous: '05c75915721349cfbd6c42ff962cf4d66ec2b05e',
                },
                { l2_block_id: block.prev_block_hash }, // previous block's l2_block_id
            );
        } else if (this.transitionManager.isTransitionPoint('bad_block_101201159', block.block_num)) {
            // Skip transactions in block 101201159 due to a hive node microfork that many validator nodes read
            // during the Hive fork. This is a one-time transition point that is part of version 1.3.0 to support replaying from initial snapshot.
            return new NBlock(
                block.block_num,
                {
                    timestamp: '2025-11-15T09:55:21.000',
                    transactions: [],
                    transaction_ids: [],
                    block_id: '06083507a197f20ccb1863411d94d3c7d69657c7',
                    previous: '0608350699812e651235fec8b7249a3ed178d4b0',
                },
                { l2_block_id: block.prev_block_hash }, // previous block's l2_block_id
            );
        } else if (this.transitionManager.isTransitionPoint('bad_block_101387262', block.block_num)) {
            // Skip transactions in block 101387262 due to a hive node microfork that many validator nodes read
            // during the Hive fork. This is a one-time transition point that is part of version 1.3.0 to support replaying from initial snapshot.
            return new NBlock(
                block.block_num,
                {
                    timestamp: '2025-11-21T21:27:54.000',
                    transactions: [],
                    transaction_ids: [],
                    block_id: '060b0bfeecfece0743f61e8b0f26335839f6557f',
                    previous: '060b0bfd484a25cd78093ddfdbf09a28342c4df8',
                },
                { l2_block_id: block.prev_block_hash }, // previous block's l2_block_id
            );
        }
        return super.transformBlock(block);
    }
}
