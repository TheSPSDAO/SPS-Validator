import { inject, injectable } from 'tsyringe';
import { Handle, ValidatorRepository, ValidatorWatch } from '@steem-monsters/splinterlands-validator';

@injectable()
export class SpsValidatorRepository extends ValidatorRepository {
    public constructor(@inject(Handle) handle: Handle, @inject(ValidatorWatch) watcher: ValidatorWatch) {
        super(handle, watcher);
    }
}
