const always: unique symbol = Symbol.for('always');
export type static_block_range = number | typeof always;

export function isAlways(br: static_block_range): br is typeof always {
    return br === always;
}

type dynamic_block_range<T> = ((v: T) => number) | static_block_range;

interface Normalize<T, N> {
    normalize(v: T): N;
}

function normalizeBlockRange<T>(range: dynamic_block_range<T>, v: T): static_block_range {
    if (typeof range === 'function') {
        return range(v);
    } else {
        return range;
    }
}

export class StaticBlockRangeConfig {
    constructor(readonly from_block: static_block_range, readonly to_block: static_block_range) {}

    canRun(block_num: number): boolean {
        return this.notTooEarly(block_num) && this.notTooLate(block_num);
    }

    private notTooEarly(block_num: number) {
        if (this.from_block === always) {
            return true;
        } else {
            return block_num >= this.from_block;
        }
    }

    private notTooLate(block_num: number) {
        if (this.to_block === always) {
            return true;
        } else {
            return block_num < this.to_block;
        }
    }
}

export type BlockRangeOpts<T> = Partial<{ from_block: dynamic_block_range<T>; to_block: dynamic_block_range<T> }>;

export class BlockRangeConfig<T> implements Normalize<T, StaticBlockRangeConfig> {
    readonly from_block: dynamic_block_range<T>;
    readonly to_block: dynamic_block_range<T>;

    constructor({ from_block = always, to_block = always }: BlockRangeOpts<T> = {}) {
        this.from_block = from_block;
        this.to_block = to_block;
    }

    normalize(v: T): StaticBlockRangeConfig {
        return new StaticBlockRangeConfig(normalizeBlockRange(this.from_block, v), normalizeBlockRange(this.to_block, v));
    }
}

export type BaseRoute<H> = {
    action_name: string;
    handler: H;
};

export class StaticRoute<H> implements BaseRoute<H> {
    constructor(readonly action_name: string, readonly handler: H, readonly blockRange: StaticBlockRangeConfig) {}

    canRun(block_num: number, action_name: string): boolean {
        if (action_name !== this.action_name) return false;
        return this.blockRange.canRun(block_num);
    }
}

export class Route<T, H> implements BaseRoute<H>, Normalize<T, StaticRoute<H>> {
    constructor(readonly action_name: string, readonly handler: H, readonly blockRange: BlockRangeConfig<T> = new BlockRangeConfig<T>()) {}

    normalize(v: T): StaticRoute<H> {
        return new StaticRoute(this.action_name, this.handler, this.blockRange.normalize(v));
    }

    canRun(block_num: number, action_name: string, v: T): boolean {
        if (action_name !== this.action_name) return false;
        return this.blockRange.normalize(v).canRun(block_num);
    }
}

export interface IRouter<H, T> {
    route(block_num: number, name: string): null | H;
    routeDynamic(block_num: number, name: string, v: T): null | H;
    recompute(v: T): this;
}

export interface IMutableRouter<H, T> extends IRouter<H, T> {
    addRoute(route: Route<T, H>): this;
}

export class Router<H, T = void> implements IMutableRouter<H, T> {
    private readonly routes: Route<T, H>[] = [];
    protected readonly cachedRoutes: StaticRoute<H>[] = [];

    routeDynamic(block_num: number, name: string, v: T): H | null {
        for (const route of this.routes) {
            if (route.canRun(block_num, name, v)) {
                return route.handler;
            }
        }
        return null;
    }

    addRoute(route: Route<T, H>) {
        this.routes.push(route);
        return this;
    }

    protected assertRecomputed() {
        if (this.numRoutes !== this.numCachedRoutes) {
            throw new Error('New routes added, should recompute before calling route.');
        }
    }

    protected get numRoutes(): number {
        return this.routes.length;
    }

    private get numCachedRoutes(): number {
        return this.cachedRoutes.length;
    }

    route(block_num: number, name: string): H | null {
        this.assertRecomputed();
        for (const route of this.cachedRoutes) {
            if (route.canRun(block_num, name)) {
                return route.handler;
            }
        }
        return null;
    }

    recompute(v: T) {
        this.cachedRoutes.length = 0;
        for (const route of this.routes) {
            this.cachedRoutes.push(route.normalize(v));
        }
        return this;
    }
}
