import { inject, injectable } from 'tsyringe';
import { ActiveDelegationsRepository, BalanceRepository, Handle, TokenUnstakingRepository } from '@steem-monsters/splinterlands-validator';

@injectable()
export class SpsActiveDelegationsRepository extends ActiveDelegationsRepository {
    public constructor(
        @inject(Handle) handle: Handle,
        @inject(BalanceRepository) balanceRepository: BalanceRepository,
        @inject(TokenUnstakingRepository) unstakingRepository: TokenUnstakingRepository,
    ) {
        super(handle, balanceRepository, unstakingRepository);
    }
}
