import { inject, singleton } from 'tsyringe';
import { BalanceRepository, PoolManager, PoolSerializer, TokenWatch } from '@steem-monsters/splinterlands-validator';

@singleton()
export class SpsPoolManager extends PoolManager {
    constructor(@inject(PoolSerializer) serializer: PoolSerializer, @inject(TokenWatch) watcher: TokenWatch, @inject(BalanceRepository) balanceRepository: BalanceRepository) {
        super(serializer, watcher, balanceRepository);
    }
}
