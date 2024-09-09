import { BlockRangeConfig, Route, Router } from './index';

describe('Simple static routing', () => {
    class StringRouter extends Router<string> {}
    const route = new Route('route_name', 'myhandler', new BlockRangeConfig());

    const oldRoute = new Route('changeling', 'oldHandler', new BlockRangeConfig({ to_block: 256 }));
    const newRoute = new Route('changeling', 'newHandler', new BlockRangeConfig({ from_block: 256 }));
    it('Needs no recomputation when empty', () => {
        const router = new StringRouter();
        const handler = router.route(7331, 'random_route');
        expect(handler).toBeNull();
    });

    it('Needs no recomputation when routing dynamically', () => {
        const router = new StringRouter().addRoute(route);
        const noHandler = router.routeDynamic(7331, 'random_route');
        const handler = router.routeDynamic(7831, 'route_name');
        expect(noHandler).toBeNull();
        expect(handler).toBe('myhandler');
    });

    it('Requires recomputation when filled', () => {
        const router = new StringRouter();
        router.addRoute(route);
        const t = () => {
            router.route(7335, 'random_route');
        };
        expect(t).toThrow();
    });

    it('Works after recomputation when filled', () => {
        const router = new StringRouter();
        router.addRoute(route);
        router.recompute();
        const randomHandler = router.route(7335, 'random_route');
        const foundHandler = router.route(3, 'route_name');
        expect(randomHandler).toBeNull();
        expect(foundHandler).toBe('myhandler');
    });

    it('Changes routing according to blocks', () => {
        const router = new StringRouter();
        router.addRoute(oldRoute);
        router.addRoute(newRoute);
        router.recompute();
        const beforeHandler = router.route(2, 'changeling');
        const onHandler = router.route(256, 'changeling');
        const afterHandler = router.route(300, 'changeling');
        expect(beforeHandler).toBe('oldHandler');
        expect(onHandler).toBe('newHandler');
        expect(afterHandler).toBe('newHandler');
    });
});

describe('Recomputed routing', () => {
    class IncRouter extends Router<string, number> {}
    const zeroRoute = new Route('static_route', 'normal', new BlockRangeConfig());
    const to = new Route('everchanging_route', 'before', new BlockRangeConfig({ to_block: (offset: number) => offset }));
    const from = new Route('everchanging_route', 'after', new BlockRangeConfig({ from_block: (offset: number) => offset }));

    it('Recomputed routing changes result for recomputed routes', () => {
        const router = new IncRouter().addRoute(zeroRoute).addRoute(to).addRoute(from).recompute(1000);
        const before_static_route = router.route(0, 'static_route');
        const before_dynamic_route = router.route(0, 'everchanging_route');
        expect(before_static_route).toBe('normal');
        expect(before_dynamic_route).toBe('before');
        router.recompute(-5300);
        const after_static_route = router.route(0, 'static_route');
        const after_dynamic_route = router.route(0, 'everchanging_route');
        expect(after_static_route).toBe('normal');
        expect(after_dynamic_route).toBe('after');
    });
});
