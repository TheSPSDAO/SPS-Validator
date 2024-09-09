import { TestWrapper } from '../__tests__/fake-db';
import { DependencyContainer } from 'tsyringe';
class Lazy<T> {
    private static readonly initial: unique symbol = Symbol.for('uninitialized');
    #value: T | typeof Lazy.initial = Lazy.initial;
    readonly #init: () => T;

    private constructor(init: () => T) {
        this.#init = init;
    }

    public static from<T>(init: () => T) {
        return new Lazy(init);
    }

    public get value(): T {
        return this.#value === Lazy.initial ? (this.#value = this.#init()) : this.#value;
    }
}

const lazy_container = Lazy.from(() => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { container } = require('../__tests__/test-composition-root');
    return container as DependencyContainer;
});

const t = Lazy.from(() => lazy_container.value.resolve<TestWrapper>(TestWrapper).test);
Object.defineProperty(test, 'dbOnly', { get: () => t.value });

// we're using testcontainers now so test timeouts need to be pretty high.
jest.setTimeout(60_000);
