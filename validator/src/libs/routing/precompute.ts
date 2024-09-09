import { BaseRoute, IRouter, isAlways, Router, static_block_range, StaticRoute } from './index';
import { log, LogLevel, zip } from '../../utils';

/**
 * Base class that allows you to do all computation on recompute; future route calls use this cache in the future, making them relatively fast.
 * Might be slower if the rate of calling `recompute` outpaces the rate of calling `route`.
 * Can also warn you when you have overlapping routes for a specific block number, as the resulting handler is not specified, just guaranteed to be consistently the same.
 */
export class PrecomputedRouter<H, T = void> extends Router<H, T> {
    private precomputedRoutes: (block_num: number) => ReadonlyMap<string, H> = (_) => new Map();

    private static block_cuts<H>(routes: StaticRoute<H>[]): Array<number> {
        const cuts: Array<number> = [];
        const maybePush = (x: static_block_range) => {
            if (!isAlways(x)) {
                cuts.push(x);
            }
        };
        for (const route of routes) {
            maybePush(route.blockRange.from_block);
            maybePush(route.blockRange.to_block);
        }
        return cuts;
    }

    // public for test purposes.
    public static readonly _HANDLER_CONFLICT_MESSAGE = 'Choosing an handler, which is almost certainly not what you want.';

    public static assertAll<H, T>(routers: PrecomputedRouter<H, T>[]) {
        routers.forEach((r) => r.assertRecomputed());
    }
    public static lookupPerCut<H, T>(...routers: PrecomputedRouter<H, T>[]): (block_num: number) => ReadonlyMap<string, H> {
        this.assertAll(routers);

        const preCuts = routers.flatMap((r) => PrecomputedRouter.block_cuts(r.cachedRoutes));
        const cuts = [...new Set(preCuts)].sort((a, b) => a - b);
        const preRoutes = routers.flatMap((r) => r.cachedRoutes);
        const routes = [...new Set(preRoutes)];

        const getName = (route: BaseRoute<H>) => route.action_name;
        const getHandler = (route: BaseRoute<H>) => route.handler;

        const mapForCut = (cut: number) => {
            const relevantRoutes = routes.filter((r) => r.blockRange.canRun(cut));
            const map = new Map(zip(relevantRoutes.map(getName), relevantRoutes.map(getHandler)));
            if (relevantRoutes.length !== map.size) {
                log(`Action constructor lookup table for cut ${cut} seems to have some overlap.`, LogLevel.Warning);
                log(this._HANDLER_CONFLICT_MESSAGE, LogLevel.Warning);
            }
            return map;
        };
        const cutRanges = [...new Set([Number.NEGATIVE_INFINITY, ...cuts])].sort();
        const cutLookups = cutRanges.map(mapForCut);
        return (block_num: number) => {
            const firstBiggerIndex = cutRanges.findIndex((c) => block_num < c);
            if (firstBiggerIndex === -1) {
                return cutLookups[cutLookups.length - 1];
            } else {
                return cutLookups[firstBiggerIndex - 1];
            }
        };
    }

    override route(block_num: number, name: string) {
        this.assertRecomputed();
        return this.precomputedRoutes(block_num).get(name) ?? null;
    }

    override recompute(v: T) {
        super.recompute(v);
        this.precomputeRoutes();
        return this;
    }

    private precomputeRoutes() {
        this.assertRecomputed();
        this.precomputedRoutes = PrecomputedRouter.lookupPerCut(this);
    }
}

export class PrecomputedMultiRouter<H, T = void> implements IRouter<H, T> {
    private readonly routers: PrecomputedRouter<H, T>[];
    private precomputedRoutes: (block_num: number) => ReadonlyMap<string, H> = (_) => new Map();
    constructor(...routers: PrecomputedRouter<H, T>[]) {
        this.routers = routers;
    }

    recompute(v: T) {
        for (const router of this.routers) {
            router.recompute(v);
        }
        this.precomputeRoutes();
        return this;
    }

    private precomputeRoutes() {
        this.precomputedRoutes = PrecomputedRouter.lookupPerCut(...this.routers);
    }

    route(block_num: number, name: string): H | null {
        PrecomputedRouter.assertAll(this.routers);
        return this.precomputedRoutes(block_num).get(name) ?? null;
    }

    routeDynamic(block_num: number, name: string, v: T): H | null {
        for (const router of this.routers) {
            const handler = router.routeDynamic(block_num, name, v);
            if (handler !== null) {
                return handler;
            }
        }
        return null;
    }
}
