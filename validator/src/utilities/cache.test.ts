import { Cache, LockstepCache } from './cache';
import { Cloneable } from './traits';

class TestCache extends Cache<string[], string> implements Cloneable<TestCache> {
    protected updateImpl(currentState: string[], data: string): string[] {
        if (!this.canUpdate) {
            return currentState;
        }
        return [...[data], ...currentState];
    }

    protected reloadImpl(currentState: string[], newState: string[]): string[] {
        // TODO: talk with team whether copying over a cache into another one should just use reload, or clear + reload.
        // In my mind: clear resets to a 'default' state, (which might be empty).
        // Reload simply overwrites the state.
        return [...newState];
    }

    protected clearImpl(): string[] {
        return [];
    }

    public get canUpdate(): boolean {
        return this.size <= 3;
    }

    public get size(): number {
        return this.value.length;
    }

    clone(): TestCache {
        return new TestCache([]);
    }
}

class TestLockstepCache extends LockstepCache<TestCache> {
    constructor(transient: TestCache) {
        super(transient);
    }
}

test('update cache', () => {
    const testCache = new TestCache(['3', '2', '1']);
    testCache.update('4');
    expect(testCache.value[0]).toBe('4');
    expect(!testCache.canUpdate);
    testCache.update('5');
    expect(testCache.value[0]).toBe('4');
});

test('reload cache', () => {
    const testCache = new TestCache(['3', '2', '1']);
    testCache.reload(['5', '4', '3', '2', '1']);
    expect(testCache.canUpdate).toBe(false);
    expect(testCache.value).toEqual(['5', '4', '3', '2', '1']);
});

test('clear cache', () => {
    const testCache = new TestCache(['1']);
    testCache.clear();
    expect(testCache.size).toBe(0);
    expect(testCache.value).toEqual([]);
});

test('clone is empty', () => {
    const testCache = new TestCache(['1']);
    const testClone = testCache.clone();
    expect(testClone.value).toEqual([]);
});

describe('LockstepCache', () => {
    let lockstep: TestLockstepCache;
    beforeEach(() => {
        const testCache = new TestCache(['1', '7']);
        lockstep = new TestLockstepCache(testCache);
    });

    test('lockstep canonical is committed', () => {
        expect(lockstep.canonical.value).toEqual(['1', '7']);
    });

    test('uncommited changes are not propagated', () => {
        lockstep.transient.reload(['1', '-2']);
        expect(lockstep.canonical.value).toEqual(['1', '7']);
    });

    test('commited changes are propagated', () => {
        lockstep.transient.reload(['a', '-2']);
        lockstep.commit();
        expect(lockstep.canonical.value).toEqual(['a', '-2']);
    });

    test('rollback rolls back changes', () => {
        lockstep.transient.reload(['a', '-2']);
        expect(lockstep.transient.value).toEqual(['a', '-2']);
        lockstep.rollback();
        expect(lockstep.transient.value).toEqual(['1', '7']);
    });

    test('snapshot ignores transient', () => {
        lockstep.transient.reload(['a', '-2']);
        expect(lockstep.snapshot().value).toEqual(['1', '7']);
    });

    test('snapshot takes latest canonical', () => {
        lockstep.transient.reload(['1', '0']);
        lockstep.commit();
        expect(lockstep.snapshot().value).toEqual(['1', '0']);
    });

    test('snapshot ignores future commits', () => {
        lockstep.transient.reload(['1', '0']);
        lockstep.commit();
        const snapshot = lockstep.snapshot();
        lockstep.transient.reload(['3', '-8']);
        lockstep.commit();
        expect(snapshot.value).toEqual(['1', '0']);
    });
});
