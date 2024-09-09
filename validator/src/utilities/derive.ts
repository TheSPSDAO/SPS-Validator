import { addChangeHandler, Atom, removeChangeHandler, deref } from '@steem-monsters/atom';

function equalsWrapper(v1: any, v2: any) {
    return v1 === v2;
}

type Equals<T> = (v1: T, v2: T) => boolean;

type Options<T> = Partial<{
    equals: Equals<T>;
}>;

export class Quark<S, K extends keyof S> {
    private readonly id: symbol;
    private srcCache?: S;
    private cache?: S[K];
    private watcherAdded = false;
    private readonly watchers: Map<string | symbol, (previous: S[K], next: S[K]) => void> = new Map();
    private readonly equals: Equals<S[K]>;

    public constructor(private readonly src: Atom<S>, private readonly key: K, { equals = equalsWrapper }: Options<S[K]> = {}) {
        this.id = Symbol(`quark_${String(key)}`);
        this.equals = equals;
    }

    public removeWatch(key: string | symbol): void {
        const removed = this.watchers.delete(key);
        if (removed && this.watchers.size === 0) {
            this.watcherAdded = false;
            removeChangeHandler(this.src, this.id);
        }
    }

    public addWatch(key: string | symbol, watcher: (previous: S[K], next: S[K]) => void): this {
        if (this.watchers.has(key)) {
            throw new Error(`Change handler already registered for key "${String(key)}".\nRemove the existing handler before registering a new one.`);
        }
        this.watchers.set(key, watcher);
        if (!this.watcherAdded) {
            this.watcherAdded = true;
            addChangeHandler(this.src, this.id, ({ previous, current }) => {
                if (previous !== current) {
                    const oldVal = previous[this.key];
                    const newVal = current[this.key];
                    this.srcCache = current;
                    this.cache = newVal;
                    if (!this.equals(oldVal, newVal)) {
                        for (const watcher of this.watchers.values()) {
                            watcher(oldVal, newVal);
                        }
                    }
                }
            });
        }
        return this;
    }

    public deref(): S[K] {
        const source = deref(this.src);
        if (this.srcCache === source) {
            return this.cache as S[K];
        } else {
            const newVal = source![this.key];
            this.srcCache = source;
            this.cache = newVal;
            return newVal;
        }
    }
}
