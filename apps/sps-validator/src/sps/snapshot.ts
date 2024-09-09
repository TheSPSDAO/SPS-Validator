import { DependencyContainer, inject, Lifecycle, scoped } from 'tsyringe';
import { SpsConfigLoader } from './config';
import {
    AtomicState,
    LockstepCache,
    Cache,
    Cloneable,
    Injectable,
    InjectionToken,
    Snapshot,
    RawPriceFeed,
    LastBlockCache,
    UnmanagedSnapshot,
} from '@steem-monsters/splinterlands-validator';
import { ManualDisposable } from './manual-disposable';

class InjectableCacheCopy<T extends Cache<any, any> & Cloneable<T>> implements Injectable<DependencyContainer> {
    public constructor(private readonly token: InjectionToken<T>, private readonly cache: T) {}

    inject(container: DependencyContainer): void {
        const clone = this.cache.clone();
        clone.reload(this.cache.value);
        container.registerInstance(this.token, clone);
        container.registerInstance(ManualDisposable, clone);
    }
}

class InjectableLockstep<T extends Cache<any, any> & Cloneable<T>> extends LockstepCache<T> implements Injectable<DependencyContainer>, AtomicState {
    public constructor(private readonly token: InjectionToken<T>, transient: T) {
        super(transient);
    }

    inject(container: DependencyContainer): void {
        const snapshot = this.snapshot();
        container.registerInstance(this.token, snapshot);
        container.registerInstance(ManualDisposable, snapshot);
    }
}

@scoped(Lifecycle.ContainerScoped) // this is wrong
export class SpsSnapshot extends Snapshot<DependencyContainer> {
    constructor(@inject(SpsConfigLoader) configLoader: SpsConfigLoader, @inject(RawPriceFeed) feed: RawPriceFeed, @inject(LastBlockCache) lastBlockCache: LastBlockCache) {
        // TODO: this 'reverse mapping' is pretty brittle
        super(new InjectableLockstep(SpsConfigLoader, configLoader), new InjectableLockstep(RawPriceFeed, feed), new InjectableLockstep(LastBlockCache, lastBlockCache));
    }
}

@scoped(Lifecycle.ContainerScoped) // this is wrong
export class SpsUnmanagedSnapshot extends UnmanagedSnapshot<DependencyContainer> {
    constructor(@inject(SpsConfigLoader) configLoader: SpsConfigLoader, @inject(RawPriceFeed) feed: RawPriceFeed, @inject(LastBlockCache) lastBlockCache: LastBlockCache) {
        // TODO: this 'reverse mapping' is pretty brittle
        super(
            new InjectableCacheCopy<SpsConfigLoader>(SpsConfigLoader, configLoader),
            new InjectableCacheCopy<RawPriceFeed>(RawPriceFeed, feed),
            new InjectableCacheCopy<LastBlockCache>(LastBlockCache, lastBlockCache),
        );
    }
}
