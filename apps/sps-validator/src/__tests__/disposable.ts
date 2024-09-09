// Already part of tsyringe master, unreleased to NPM though

export interface Disposable {
    dispose(): Promise<void> | void;
}
export const Disposable: unique symbol = Symbol.for('Disposable');
