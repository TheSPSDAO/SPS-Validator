import { BlockRangeConfig, Route, StaticBlockRangeConfig } from './index';
import { PrecomputedMultiRouter, PrecomputedRouter } from './precompute';
import SpyInstance = jest.SpyInstance;

class PcRouter extends PrecomputedRouter<number> {}

describe('Precomputed routing still works', () => {
    class SpyRoute extends Route<void, number> {
        constructor(private readonly canRunSpy: jest.Mock, action_name: string, handler: number, blockRange?: BlockRangeConfig<void>) {
            super(action_name, handler, blockRange);
        }

        override canRun(block_num: number, action_name: string, v: void): boolean {
            this.canRunSpy();
            return super.canRun(block_num, action_name, v);
        }
    }

    class SpyBlockRangeConfig extends BlockRangeConfig<void> {
        public spy: SpyInstance | undefined;
        override normalize(v: void): StaticBlockRangeConfig {
            const retval = super.normalize(v);
            this.spy = jest.spyOn(retval, 'canRun');
            return retval;
        }
    }

    beforeEach(() => {
        console.log = jest.fn();
    });

    afterEach(() => {
        (console.log as jest.Mock).mockRestore();
    });

    it('Precomputed routes do not recompute without reason.', () => {
        const config = new SpyBlockRangeConfig({ from_block: 0 });
        const spy = jest.fn();
        const route = new SpyRoute(spy, 'the_route', 77, config);
        const router = new PcRouter().addRoute(route).recompute();

        const embeddedSpy = config.spy;
        expect(embeddedSpy).not.toBeUndefined();
        expect(embeddedSpy).toBeCalled();
        // Reset to zero;
        embeddedSpy?.mockReset();

        const noHandler = router.route(728, 'not_the_route');
        const handler = router.route(26, 'the_route');

        router.route(28, 'the_route');
        router.route(29, 'the_route');

        // Still zero, even after several times of routing;
        expect(embeddedSpy).not.toBeCalled();

        expect(noHandler).toBeNull();
        expect(handler).toBe(77);
        expect(spy).not.toBeCalled();
    });

    it('Logs conflicts', () => {
        const route = new Route('the_route', 77, new BlockRangeConfig());
        const route2 = new Route('the_route', 77, new BlockRangeConfig());
        new PcRouter().addRoute(route).addRoute(route2).recompute();
        expect(console.log).toHaveBeenCalledWith(expect.stringContaining(PrecomputedRouter._HANDLER_CONFLICT_MESSAGE));
    });

    it('Does not log conflicts when there are no conflicts', () => {
        const route = new Route('the_route', 77, new BlockRangeConfig());
        new PcRouter().addRoute(route).recompute();
        expect(console.log).not.toHaveBeenCalledWith(expect.stringContaining(PrecomputedRouter._HANDLER_CONFLICT_MESSAGE));
    });
});

describe('MultiRouting', () => {
    it('Finds all routes.', () => {
        const route1 = new Route('first_route', 'first', new BlockRangeConfig());
        const router1 = new PrecomputedRouter().addRoute(route1);
        const route2 = new Route('second_route', 'second', new BlockRangeConfig());
        const router2 = new PrecomputedRouter().addRoute(route2);

        const router = new PrecomputedMultiRouter(router1, router2).recompute();

        const noHandler = router.route(728, 'not_the_route');
        const handler1 = router.route(27, 'first_route');
        const handler2 = router.route(26, 'second_route');

        expect(noHandler).toBeNull();
        expect(handler1).toBe('first');
        expect(handler2).toBe('second');
    });

    it('Can dynamically route without recomputation.', () => {
        const route = new Route('first_route', 'first', new BlockRangeConfig());
        const subrouter = new PrecomputedRouter().addRoute(route);
        const router = new PrecomputedMultiRouter(subrouter);
        const noHandler = router.routeDynamic(728, 'not_the_route');
        const handler = router.routeDynamic(27, 'first_route');
        expect(noHandler).toBeNull();
        expect(handler).toBe('first');
    });

    it('Requires recomputation when filled', () => {
        const route = new Route('first_route', 'first', new BlockRangeConfig());
        const subrouter = new PrecomputedRouter().addRoute(route);
        const router = new PrecomputedMultiRouter(subrouter);
        const t = () => {
            router.route(1, 'first_route');
        };
        expect(t).toThrow();
    });
});
