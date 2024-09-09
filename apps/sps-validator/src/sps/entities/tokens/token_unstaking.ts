import { inject, injectable } from 'tsyringe';
import { Handle, PrefixOpts, TokenUnstakingRepository, UnstakingWatch } from '@steem-monsters/splinterlands-validator';

@injectable()
export class SpsTokenUnstakingRepository extends TokenUnstakingRepository {
    constructor(@inject(Handle) handle: Handle, @inject(UnstakingWatch) watcher: UnstakingWatch, @inject(PrefixOpts) cfg: PrefixOpts) {
        super(handle, watcher, cfg);
    }
}
