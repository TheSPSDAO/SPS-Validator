import { autoroute, route } from './decorators';
import { Router } from './index';

describe('Verify that all annotated types of routes work', () => {
    @autoroute()
    class Dummy extends Router<number> {
        @route('route1') readonly prop = 1;
        @route('route2') get getter(): number {
            return 2;
        }

        @route('route3')
        method() {
            return 3;
        }
    }

    it('Needs recomputation as it has registered routes.', () => {
        const router = new Dummy();
        const t = () => {
            router.route(7335, 'random_route');
        };
        expect(t).toThrow();
    });

    it('Needs no recomputation when routing dynamically.', () => {
        const router = new Dummy();
        const noHandler = router.routeDynamic(535, 'random_route');
        const handler = router.routeDynamic(3, 'route1');
        expect(noHandler).toBeNull();
        expect(handler).toBe(1);
    });

    it('Works after recomputation.', () => {
        const router = new Dummy().recompute();
        const noHandler = router.route(721, 'random_route');
        const handler = router.route(920, 'route3');
        expect(noHandler).toBeNull();
        expect(handler).toBe(3);
    });
});

describe('Recomputed routing', () => {
    @autoroute()
    class Dummy extends Router<string, number> {
        @route('the_route', { to_block: (x: number) => x }) oldProp = 'old';
        @route('the_route', { from_block: (x: number) => x }) newProp = 'new';
    }

    it.each`
        recompute | route              | early    | middle   | late
        ${0}      | ${'the_route'}     | ${'new'} | ${'new'} | ${'new'}
        ${0}      | ${'not_the_route'} | ${null}  | ${null}  | ${null}
        ${100}    | ${'the_route'}     | ${'old'} | ${'new'} | ${'new'}
        ${100}    | ${'not_the_route'} | ${null}  | ${null}  | ${null}
        ${101}    | ${'the_route'}     | ${'old'} | ${'old'} | ${'new'}
        ${9654}   | ${'the_route'}     | ${'old'} | ${'old'} | ${'old'}
    `(`Routing over [$route] for [$recompute] works out`, ({ recompute, route, early, middle, late }) => {
        const router = new Dummy().recompute(recompute);
        const handler1 = router.route(1, route);
        const handler2 = router.route(100, route);
        const handler3 = router.route(1000, route);
        expect(handler1).toBe(early);
        expect(handler2).toBe(middle);
        expect(handler3).toBe(late);
    });
});
