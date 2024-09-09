import { HiveClient, HiveOptions, PrefixOpts, ValidatorOpts } from '@steem-monsters/splinterlands-validator';
import { inject, singleton } from 'tsyringe';

@singleton()
export class SpsHiveClient extends HiveClient {
    constructor(@inject(HiveOptions) cfg: HiveOptions, @inject(ValidatorOpts) validatorConfig: ValidatorOpts, @inject(PrefixOpts) prefixOpts: PrefixOpts) {
        super(cfg, validatorConfig, prefixOpts);
    }
}
