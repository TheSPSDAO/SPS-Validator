import * as pg from 'pg';

class _ extends null {
    static {
        // TODO: Convert to const enum instead of magic constant when @types/pg ever gets added.
        // Convert bigserial + bigint (both with typeId = 20) to BigInt:
        pg.types.setTypeParser(20, BigInt);
    }
}
