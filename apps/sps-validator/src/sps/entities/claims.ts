import { inject, injectable } from 'tsyringe';
import { PoolClaimPayloads, PoolManager, PrefixOpts } from '@steem-monsters/splinterlands-validator';

@injectable()
export class SpsPoolClaimPayloads extends PoolClaimPayloads {
    constructor(@inject(PrefixOpts) cfg: PrefixOpts, @inject(PoolManager) poolManager: PoolManager) {
        super(cfg, poolManager);
    }
}
