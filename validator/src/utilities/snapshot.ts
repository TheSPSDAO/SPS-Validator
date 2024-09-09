import { Container } from './dependency-injection';
import { Disposable } from 'tsyringe';

export interface AtomicState {
    commit(): void;
    rollback(): void;
}

export interface Injectable<T extends Container> {
    inject(container: T): void;
    dispose?(): void;
}

export class Snapshot<T extends Container> implements Disposable {
    private readonly lockstepCaches: (Injectable<T> & AtomicState)[];
    constructor(...lockstepCaches: (Injectable<T> & AtomicState)[]) {
        this.lockstepCaches = lockstepCaches;
    }

    commit() {
        for (const lockstepCache of this.lockstepCaches) {
            lockstepCache.commit();
        }
    }

    rollback() {
        for (const lockstepCache of this.lockstepCaches) {
            lockstepCache.rollback();
        }
    }

    injectAll(container: T) {
        for (const lockstepCache of this.lockstepCaches) {
            lockstepCache.inject(container);
        }
    }

    dispose() {
        for (const lockstepCache of this.lockstepCaches) {
            if (lockstepCache.dispose) {
                lockstepCache.dispose();
            }
        }
    }
}

export class UnmanagedSnapshot<T extends Container> {
    private readonly injectables: Injectable<T>[];
    constructor(...injectables: Injectable<T>[]) {
        this.injectables = injectables;
    }

    injectAll(container: T) {
        for (const lockstepCache of this.injectables) {
            lockstepCache.inject(container);
        }
    }
}
