import { inject, injectable } from 'tsyringe';
import { PoolClaimPayloads, PrefixOpts } from '@steem-monsters/splinterlands-validator';

@injectable()
export class SpsPoolClaimPayloads extends PoolClaimPayloads {
    constructor(@inject(PrefixOpts) cfg: PrefixOpts) {
        super(cfg);
    }
}
