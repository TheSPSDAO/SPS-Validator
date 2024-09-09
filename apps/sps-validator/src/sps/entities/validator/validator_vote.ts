import { BalanceRepository, Handle, Trx, ValidatorVoteHistoryRepository, ValidatorVoteRepository, VoteWeightCalculator } from '@steem-monsters/splinterlands-validator';
import { inject, injectable } from 'tsyringe';
import { TOKENS } from '../../features/tokens';

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
        @inject(Handle) handle: Handle,
        @inject(VoteWeightCalculator) voteWeightCalculator: VoteWeightCalculator,
        @inject(ValidatorVoteHistoryRepository) validatorVoteHistoryRepository: ValidatorVoteHistoryRepository,
    ) {
        super(handle, voteWeightCalculator, validatorVoteHistoryRepository);
    }
}
