import { inject, injectable } from 'tsyringe';
import { BalanceRepository, BurnOpts, ClearBurnedTokensSource, PrefixOpts } from '@steem-monsters/splinterlands-validator';

@injectable()
export class SpsClearBurnedTokensSource extends ClearBurnedTokensSource {
    constructor(@inject(PrefixOpts) prefixOpts: PrefixOpts, @inject(BurnOpts) burnOpts: BurnOpts, @inject(BalanceRepository) balanceRepo: BalanceRepository) {
        super(prefixOpts, burnOpts, balanceRepo);
    }
}
