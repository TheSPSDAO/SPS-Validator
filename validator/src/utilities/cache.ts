import { Atom, swap, deref, addChangeHandler, DeepImmutable, removeChangeHandler, set, dispose } from '@steem-monsters/atom';
import { Disposable } from 'tsyringe';
import { Cloneable } from './traits';
import { Quark } from './derive';

/**
 * Standardized caching implementation...
 */
export abstract class Cache<Structure, Data> implements Disposable {
    private cache: Atom<Structure>;

    constructor(cache: Structure) {
        this.cache = Atom.of(cache);
    }

    protected quark<K extends keyof Structure>(key: K) {
        return new Quark(this.cache, key);
    }

    /**
     * Return immutable Cache.
     */
    public get value(): DeepImmutable<Structure> {
        return deref(this.cache);
    }

    /**
     * Update current Cache with new Data.
     */
    public update(data: Data): void {
        swap(this.cache, (state) => this.updateImpl(state, data));
    }

    /**
     * Replace Cache with new Cache.
     * @param newState
     */
    public reload(newState: Structure): void {
        swap(this.cache, (state) => this.reloadImpl(state, newState));
    }

    /**
     * Remove all elements from Cache.
     */
    public clear(): void {
        set(this.cache, this.clearImpl());
    }

    /**
     * Add change handler to cache
     * @param name
     * @param func
     */
    public addChangeHandler(name: string | symbol, func: (state: { current: Structure; previous: Structure }) => void): void {
        addChangeHandler(this.cache, name, func);
    }

    /**
     * Remove change handler to cache
     * @param name
     * @param func
     */
    public removeChangeHandler(name: string | symbol): void {
        removeChangeHandler(this.cache, name);
    }

    public dispose() {
        dispose(this.cache);
    }

    protected abstract updateImpl(currentState: Structure, data: Data): Structure;
    protected abstract reloadImpl(currentState: Structure, newState: Structure): Structure;
    protected abstract clearImpl(): Structure;
    public abstract get canUpdate(): boolean;
    public abstract get size(): number | undefined;
}

/**
 * The LockStepCache deals with several copies of a cache.
 * - a transient one, that is updated in small steps, just like it would normally be
 * - a canonical one, that should only be updated once the transient updates are 'irreversible'
 * - a snapshot, that should only be generated/filled once we need an unchanging view of the current canonical one.
 */
export abstract class LockstepCache<T extends Cache<any, any> & Cloneable<T>> implements Disposable {
    public readonly canonical: T;
    protected constructor(public readonly transient: T) {
        this.canonical = transient.clone();
        this.commit();
    }

    commit() {
        this.canonical.reload(this.transient.value);
    }

    rollback() {
        this.transient.reload(this.canonical.value);
    }

    /**
     * Clones the current cache and returns a new one. You are responsible for disposing of this new cache.
     */
    snapshot() {
        const fresh = this.canonical.clone();
        fresh.reload(this.canonical.value);
        return fresh;
    }

    dispose() {
        this.canonical.dispose();
    }
}
