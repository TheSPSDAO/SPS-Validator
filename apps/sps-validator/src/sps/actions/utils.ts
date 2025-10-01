import {
    ActionFactory,
    ActionRouter,
    BasePayloadSourceWrapper,
    BlockRangeConfig,
    Compute,
    IAction,
    InjectionToken,
    MultiActionRouter,
    OperationData,
    Route,
    VirtualPayloadSource,
} from '@steem-monsters/splinterlands-validator';
import { inject, injectable } from 'tsyringe';

type Constructor<T> = new (...args: any[]) => T;

type InferAction<T> = T extends Constructor<infer A> ? (A extends IAction ? A : never) : never;
type MapToInjectionToken<T> = { [K in keyof T]: InjectionToken<T[K]> };
type FilterActionParameters<T extends Constructor<IAction>> = ConstructorParameters<T> extends [OperationData, unknown, number, ...infer R] ? MapToInjectionToken<R> : never;

/**
 * Helper to create an action factory for a very specific scenario (that we use a lot, hence the helper).
 * It will drive you nuts if you don't use it, because it's A LOT of boilerplate otherwise.
 *
 * **Usage:**
 * ```
 * export const MyActionFactory = MakeActionFactory(MyAction, MyDependency);
 * ```
 *
 * @param action The action class to create a factory for.
 * @param actionArgs The arguments to inject into the action class at the end (after op, data, index).
 * @returns The action factory class for injection elsewhere.
 */
export function MakeActionFactory<T extends Constructor<IAction>, TAction extends IAction = InferAction<T>>(
    action: T,
    ...actionArgs: FilterActionParameters<T>
): Constructor<ActionFactory<TAction>> {
    const clazz = class implements ActionFactory<TAction> {
        private readonly classArgs: ConstructorParameters<T>;
        constructor(...args: ConstructorParameters<T>) {
            this.classArgs = args;
        }
        build(op: OperationData, data: unknown, index?: number): TAction {
            return new action(op, data, index, ...this.classArgs) as TAction;
        }
    };
    actionArgs.forEach((arg, i) => inject(arg)(clazz, undefined, i));
    injectable()(clazz);
    return clazz;
}

/**
 * Helper to create a router for a very specific scenario (that we use a lot, hence the helper).
 *
 * **Usage:**
 * ```
 * export const MyRouter = MakeRouter('my_action', MyActionFactory);
 * ```
 *
 * @param action the action name to route to this action
 * @param factoryCtor  the action factory
 * @param blockRange optional block range
 * @returns The action router class for injection elsewhere.
 */
export function MakeRouter<T extends IAction>(action: string, factoryCtor: Constructor<ActionFactory<T>>, blockRange?: BlockRangeConfig<Compute>): Constructor<ActionRouter<T>> {
    const clazz = class extends ActionRouter<T> {
        constructor(factory: ActionFactory<T>) {
            super();
            this.addRoute(new Route<Compute, ActionFactory<T>>(action, factory, blockRange));
        }
    };
    inject(factoryCtor)(clazz, undefined, 0);
    injectable()(clazz);
    return clazz;
}

export function MakeMultiRouter(...routers: InjectionToken<ActionRouter<IAction>>[]) {
    const clazz = class extends MultiActionRouter {
        constructor(...args: ActionRouter<IAction>[]) {
            super(...args);
        }
    };
    routers.forEach((router, i) => inject(router)(clazz, undefined, i));
    injectable()(clazz);
    return clazz;
}

export function MakeVirtualPayloadSource(...sources: InjectionToken<VirtualPayloadSource>[]) {
    const clazz = class extends BasePayloadSourceWrapper {
        constructor(...args: VirtualPayloadSource[]) {
            super(...args);
        }
    };
    sources.forEach((source, i) => inject(source)(clazz, undefined, i));
    injectable()(clazz);
    return clazz;
}
