import { BaseRepository, Handle, Trx, ValidatorEntity as Validator_ } from '../../db/tables';
import { ValidatorWatch } from '../../config';
import { BlockRef } from '../block';
import { getTableName } from '@wwwouter/typed-knex';
import { EventLog, EventTypes } from '../event_log';

export type ValidatorEntry = {
    account_name: string;
    is_active: boolean;
    post_url: string | null;
    total_votes: number;
    missed_blocks: number;
};

export class ValidatorRepository extends BaseRepository {
    public constructor(handle: Handle, private readonly watcher: ValidatorWatch) {
        super(handle);
    }

    public readonly table = getTableName(Validator_);

    private static into(row: Validator_): ValidatorEntry {
        return { ...row, total_votes: parseFloat(row.total_votes) };
    }

    public async register(params: { account: string; is_active: boolean; post_url?: string }, trx?: Trx) {
        const record = await this.query(Validator_, trx)
            .useKnexQueryBuilder((query) =>
                query
                    .insert({
                        account_name: params.account,
                        is_active: params.is_active,
                        post_url: params.post_url,
                    })
                    .onConflict('account_name')
                    .merge()
                    .returning('*'),
            )
            .getFirstOrNull();
        return new EventLog(EventTypes.UPSERT, this, ValidatorRepository.into(record!));
    }

    public getValidators(trx?: Trx, limit?: number) {
        let q = this.query(Validator_, trx).orderBy('total_votes', 'desc').orderBy('account_name');

        if (limit !== undefined) {
            q = q.limit(limit);
        }

        return q.getMany();
    }

    async lookup(account_name: string, trx?: Trx): Promise<ValidatorEntry | null> {
        const record = await this.query(Validator_, trx).where('account_name', account_name).getFirstOrNull();
        return record ? ValidatorRepository.into(record) : null;
    }

    public async getBlockValidator(block: Pick<BlockRef, 'prng'>, trx?: Trx): Promise<ValidatorEntry | null> {
        // HACK: can't filter on Numeric
        const validators = await this.query(Validator_, trx).where('is_active', true).getMany();
        const valid_validators = validators.map(ValidatorRepository.into).filter((v) => v.total_votes > 0);

        const min_validators = this.watcher.validator?.min_validators;
        if (min_validators === undefined || validators.length < min_validators) {
            return null;
        } else {
            const rng = block.prng;
            const total_votes = valid_validators.reduce((t, v) => t + v.total_votes, 0);
            const index = rng() * total_votes;
            let total = 0;
            let i;
            for (i = 0; i < valid_validators.length; i++) {
                total += valid_validators[i].total_votes;
                if (index < total) {
                    return valid_validators[i];
                }
            }
            return valid_validators[i];
        }
    }
}
