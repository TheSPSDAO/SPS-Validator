import { BlockRangeConfig, BlockRangeOpts, IMutableRouter, Route } from './index';

type PropOrGetter<T> = T | (() => T);
function isGetter<T>(propOrGetter: PropOrGetter<T>): propOrGetter is () => T {
    return typeof propOrGetter === 'function';
}

type Constructor<T> = new (...args: any[]) => T;
type RouterHandler<T> = T extends IMutableRouter<infer H, any> ? H : never;
type RouterType<T> = T extends IMutableRouter<any, infer V> ? V : never;
type RouterRoute<T> = T extends IMutableRouter<infer H, infer V> ? Route<V, H> : never;
type RoutingRecord<T, K extends string | symbol> = Record<K, PropOrGetter<RouterHandler<T>>> & IMutableRouter<RouterHandler<T>, RouterType<T>>;

type Delayed<C, V> = (instance: C) => V;
type DelayedRoute<C> = Delayed<C, RouterRoute<C>>;

class Meta extends null {
    static readonly #ROUTES_KEY: unique symbol = Symbol.for('__ROUTES__');

    static getRoutes<C extends IMutableRouter<any, any>>(target: Constructor<C>): DelayedRoute<C>[] {
        const routes: DelayedRoute<C>[] = Reflect.getMetadata(Meta.#ROUTES_KEY, target) || [];
        return routes;
    }

    static addRoute<C extends IMutableRouter<any, any>>(target: Constructor<C>, route: DelayedRoute<C>) {
        // Fresh copy to prevent mutating things.
        const routes = Meta.getRoutes(target).slice();
        routes.push(route);
        Reflect.metadata(Meta.#ROUTES_KEY, routes)(target);
    }
}

function extractValue<V, K extends string | symbol, C extends Record<K, PropOrGetter<V>>>(c: C, key: K): V {
    const propOrGetter = c[key] as PropOrGetter<V>;
    if (isGetter(propOrGetter)) {
        return propOrGetter.bind(c)();
    } else {
        return propOrGetter;
    }
}

/**
 * Annotate a method, property or getter that resolves to a valid Handler for this Router.
 * Ensures the router can route to this handler by constructing a route and adding it after constructing the class instance.
 * @param name - action name to route with.
 * @param bro - configuration to determine routing
 */
export function route<V = any>(name: string, bro?: BlockRangeOpts<V>) {
    return <T extends RoutingRecord<T, K> & IMutableRouter<any, V>, K extends string | symbol>(target: T, key: K) => {
        const constructor = target.constructor as Constructor<T>;
        const lazyRoute: DelayedRoute<T> = (instance) => {
            const handler = extractValue<RouterHandler<T>, K, T>(instance, key);
            const cfg = new BlockRangeConfig(bro as BlockRangeOpts<RouterType<T>>);
            return new Route(name, handler, cfg) as RouterRoute<T>;
        };
        Meta.addRoute(constructor, lazyRoute);
    };
}

/**
 * Annotate a class that implements a Router. Ensures all @route annotations are hooked up at instance construction.
 *
 * note: this is broken and you should not use it. it wipes out all the previous decorator metadata which breaks injection.
 */
export function autoroute() {
    return <T extends Constructor<IMutableRouter<any, any>>>(constructor: T) => {
        return class extends constructor {
            constructor(...args: any[]) {
                super(...args);
                const delayedRoutes = Meta.getRoutes(constructor);
                for (const delayedRoute of delayedRoutes) {
                    const route = delayedRoute(this);
                    this.addRoute(route);
                }
            }
        };
    };
}

export function addRoutesForClass<T extends Constructor<IMutableRouter<any, any>>>(constructor: T, instance: InstanceType<T>) {
    const delayedRoutes = Meta.getRoutes(constructor);
    const routes = delayedRoutes.map((delayedRoute) => delayedRoute(instance));
    for (const route of routes) {
        instance.addRoute(route);
    }
}
