import { Prime } from './traits';
import { Trx } from '../db/tables';

export class Primer implements Prime {
    private readonly primes: Prime[];
    constructor(...primes: Prime[]) {
        this.primes = primes;
    }

    async prime(trx?: Trx): Promise<void> {
        for (const prime of this.primes) {
            await prime.prime(trx);
        }
    }
}
