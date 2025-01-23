import { BaseRepository, Handle, PriceHistoryEntity, Trx } from '../../db/tables';

export type PriceEntry = {
    validator: string;
    token: string;
    block_num: number;
    block_time: Date;
    token_price: number;
};

// Adapted from https://stackoverflow.com/questions/40774697/how-can-i-group-an-array-of-objects-by-key#answer-48981669
// Copyright 2018 cdiggings (https://stackoverflow.com/users/184528/cdiggins)
// Licensed under CC BY-SA 4.0
function groupBy<T>(xs: Array<T>, f: (t: T) => string) {
    return xs.reduce((r: Record<string, Array<T>>, v, i, _, k = f(v)) => ((r[k] || (r[k] = [])).push(v), r), {});
}

export class PriceHistoryRepository extends BaseRepository {
    public constructor(handle: Handle) {
        super(handle);
    }

    private static from(entry: PriceEntry): PriceHistoryEntity {
        return {
            ...entry,
            token_price: String(entry.token_price),
        };
    }

    private static into(row: PriceHistoryEntity): PriceEntry {
        return {
            ...row,
            token_price: parseFloat(row.token_price),
        };
    }

    public async groupedHistory(since = new Date(0), trx?: Trx) {
        const records = await this.query(PriceHistoryEntity, trx).where('block_time', '>', since).orderBy('block_time', 'desc').orderBy('validator', 'desc').getMany();
        return groupBy(records.map(PriceHistoryRepository.into), (t) => t.token);
    }

    public async getLastPriceEntry(validator: string, token: string, trx?: Trx): Promise<PriceEntry | null> {
        const record = await this.query(PriceHistoryEntity, trx).where('validator', validator).where('token', token).orderBy('block_time', 'desc').getFirstOrNull();
        return record ? PriceHistoryRepository.into(record) : null;
    }

    public async upsert(payload: PriceEntry, trx?: Trx) {
        const record = await this.query(PriceHistoryEntity, trx)
            // can we have multiple entries for the same validator and token for a given block?
            .useKnexQueryBuilder((query) => query.insert(PriceHistoryRepository.from(payload)).onConflict(['validator', 'token']).merge().returning('*'))
            .getFirst();
        return PriceHistoryRepository.into(record);
    }
}
