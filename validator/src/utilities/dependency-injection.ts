declare type constructor<T> = {
    new (...args: any[]): T;
};

export type InjectionToken<T> = constructor<T> | string | symbol;

export interface Resolver {
    resolve<T>(token: InjectionToken<T>): T;
}
export const Resolver: unique symbol = Symbol('Resolver');

export interface Container {
    // Can't constrain provider without coupling to tsyringe
    register<T>(token: InjectionToken<T>, provider: unknown): T;
}
export const Container: unique symbol = Symbol('Container');
