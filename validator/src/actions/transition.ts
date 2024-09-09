import { RouterType } from './ActionConstructor';
import { ValidatorWatch } from '../config';
import { TopActionRouter, VirtualActionRouter } from './index';

type ConstLookup<T> = T[keyof T];

export class LookupWrapper {
    // TODO: Ideally the atom library supports (unique) symbols for registering change handlers.
    private static ChangeKeys = {
        normal: Symbol('router-resetter'),
        virtual: Symbol('virtual-router-resetter'),
    } as const;

    static computeAndWatch<T extends string | symbol>(router: RouterType, watcher: ValidatorWatch, key: ConstLookup<typeof LookupWrapper.ChangeKeys> | T) {
        router.recompute(watcher.validator);
        watcher.removeValidatorWatcher(key);
        watcher.addValidatorWatcher(key, (validator) => {
            router.recompute(validator);
        });
    }

    constructor(private readonly router: TopActionRouter, private readonly virtualRouter: VirtualActionRouter, watcher: ValidatorWatch) {
        // Passing never ensures we only use the const properties from ChangeKeys internally
        LookupWrapper.computeAndWatch<never>(router, watcher, LookupWrapper.ChangeKeys.normal);
        LookupWrapper.computeAndWatch<never>(virtualRouter, watcher, LookupWrapper.ChangeKeys.virtual);
    }

    public lookupOpsConstructor(block_num: number, action_name: string, isVirtual: boolean) {
        const router = isVirtual ? this.virtualRouter : this.router;
        return router.route(block_num, action_name);
    }
}
