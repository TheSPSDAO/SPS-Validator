import { BalanceRepository, Handle, Trx, ValidatorVoteHistoryRepository, ValidatorVoteRepository, VoteWeightCalculator } from '@steem-monsters/splinterlands-validator';
import { inject, injectable } from 'tsyringe';
import { TOKENS } from '../../features/tokens';
import { TransitionManager } from '../../features/transition';
import { ValidatorEntryVersion } from 'validator/src/entities/validator/validator';

@injectable()
export class SpsVoteWeightCalculator implements VoteWeightCalculator {
    constructor(@inject(BalanceRepository) private readonly balanceRepository: BalanceRepository) {}

    calculateVoteWeight(account: string, trx?: Trx): Promise<number> {
        return this.balanceRepository.getBalance(account, TOKENS.SPSP, trx);
    }
}

@injectable()
export class SpsValidatorVoteRepository extends ValidatorVoteRepository {
    constructor(
        @inject(TransitionManager) private readonly transitionManager: TransitionManager,
        @inject(Handle) handle: Handle,
        @inject(VoteWeightCalculator) voteWeightCalculator: VoteWeightCalculator,
        @inject(ValidatorVoteHistoryRepository) validatorVoteHistoryRepository: ValidatorVoteHistoryRepository,
    ) {
        super(handle, voteWeightCalculator, validatorVoteHistoryRepository);
    }

    protected validatorEntryVersion(block_num: number): ValidatorEntryVersion {
        return this.transitionManager.isTransitioned('adjust_token_distribution_strategy', block_num) ? 'v2' : 'v1';
    }
}
