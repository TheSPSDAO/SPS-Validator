import type { PRNG } from 'seedrandom';

export function* make_probability_iterator(probability: number, rng: PRNG): Generator<boolean, never, void> {
    while (true) {
        const bool = probability > rng();
        yield bool;
    }
}

type Reserve = {
    true: number;
    false: number;
};

function constrain(v: number) {
    return Number.isSafeInteger(v) && v >= 0;
}

export function* make_dynamic_pool_iterator(reserves: Reserve, rng: PRNG): Generator<boolean, void, void> {
    let true_left = reserves.true;
    let false_left = reserves.false;

    console.assert(constrain(true_left) && constrain(false_left), 'Either of the reserves is not a safe integer >= 0');

    while (true_left > 0 || false_left > 0) {
        const true_probability = true_left / (true_left + false_left);

        console.assert(true_probability >= 0, `Probability below 0: ${true_probability}`);
        console.assert(true_probability <= 1, `Probability above 1: ${true_probability}`);

        if (true_probability > rng()) {
            true_left -= 1;
            yield true;
        } else {
            false_left -= 1;
            yield false;
        }
    }
}
