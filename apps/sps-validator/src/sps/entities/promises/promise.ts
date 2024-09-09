import { Handle, PromiseRepository } from '@steem-monsters/splinterlands-validator';
import { inject, injectable } from 'tsyringe';

@injectable()
export class SpsPromiseRepository extends PromiseRepository {
    public constructor(@inject(Handle) handle: Handle) {
        super(handle);
    }
}
