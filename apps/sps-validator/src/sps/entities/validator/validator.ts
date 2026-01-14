import { inject, injectable } from 'tsyringe';
import { Handle, ValidatorRepository, ValidatorWatch } from '@steem-monsters/splinterlands-validator';
import { TransitionManager } from '../../features/transition';

@injectable()
export class SpsValidatorRepository extends ValidatorRepository {
    public constructor(
        @inject(TransitionManager) private readonly transitionManager: TransitionManager,
        @inject(Handle) handle: Handle,
        @inject(ValidatorWatch) watcher: ValidatorWatch,
    ) {
        super(handle, watcher);
    }

    protected validatorEntryVersion(block_num: number) {
        return this.transitionManager.isTransitioned('adjust_token_distribution_strategy', block_num) ? 'v2' : 'v1';
    }
}
