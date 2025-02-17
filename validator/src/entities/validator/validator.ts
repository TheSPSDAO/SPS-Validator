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
    reward_account: string | null;
};

export type GetValidatorsParams = {
    limit?: number;
    skip?: number;
    is_active?: boolean;
    count?: boolean;
    search?: string;
    reward_account?: string;
};

export class ValidatorRepository extends BaseRepository {
    public constructor(handle: Handle, private readonly watcher: ValidatorWatch) {
        super(handle);
    }

    public readonly table = getTableName(Validator_);

    private static into(row: Validator_): ValidatorEntry {
        return { ...row, total_votes: parseFloat(row.total_votes) };
    }

    public async register(params: { account: string; is_active: boolean; post_url?: string; reward_account?: string }, trx?: Trx) {
        const record = await this.query(Validator_, trx)
            .useKnexQueryBuilder((query) =>
                query
                    .insert({
                        account_name: params.account,
                        is_active: params.is_active,
                        post_url: params.post_url,
                        reward_account: params.reward_account ?? null,
                    })
                    .onConflict('account_name')
                    .merge()
                    .returning('*'),
            )
            .getFirstOrNull();
        return new EventLog(EventTypes.UPSERT, this, ValidatorRepository.into(record!));
    }

    public async incrementMissedBlocks(account: string, increment: number, trx?: Trx) {
        const record = await this.query(Validator_, trx)
            .where('account_name', account)
            .useKnexQueryBuilder((query) => query.increment('missed_blocks', increment))
            .updateItemWithReturning({}, ['account_name', 'missed_blocks', 'is_active', 'post_url', 'total_votes', 'reward_account']);
        return [new EventLog(EventTypes.UPDATE, this, ValidatorRepository.into(record))];
    }

    public async getValidators(params?: GetValidatorsParams, trx?: Trx) {
        let q = this.query(Validator_, trx).orderBy('total_votes', 'desc').orderBy('account_name');
        let countQuery = this.query(Validator_, trx);

        if (params?.is_active !== undefined) {
            q = q.where('is_active', params.is_active);
            countQuery = countQuery.where('is_active', params.is_active);
        }
        if (params?.reward_account !== undefined) {
            q = q.where('reward_account', params.reward_account);
            countQuery = countQuery.where('reward_account', params.reward_account);
        }
        if (params?.limit !== undefined) {
            q = q.limit(params.limit);
        }
        if (params?.skip !== undefined) {
            q = q.offset(params.skip);
        }

        if (params?.search) {
            q = q.where('account_name', 'ilike', `%${params.search}%`);
            countQuery = countQuery.where('account_name', 'ilike', `%${params.search}%`);
        }

        const count = params?.count ? await countQuery.getCount() : undefined;
        // count only query
        if (params?.limit === 0 && params?.skip === 0) {
            return {
                validators: [],
                count,
            };
        }

        const validators = await q.getMany();
        return {
            validators,
            count,
        };
    }

    public async isTopValidator(account_name: string, num_top_validators: number, trx?: Trx) {
        const validators = await this.query(Validator_, trx)
            .where('is_active', true)
            .where('total_votes', '>', 0 as unknown as string)
            .orderBy('total_votes', 'desc')
            .orderBy('account_name')
            .limit(num_top_validators)
            .select('account_name')
            .getMany();
        return validators.some((v) => v.account_name === account_name);
    }

    async lookup(account_name: string, trx?: Trx): Promise<ValidatorEntry | null> {
        const record = await this.query(Validator_, trx).where('account_name', account_name).getFirstOrNull();
        return record ? ValidatorRepository.into(record) : null;
    }

    public async getBlockValidator(block: Pick<BlockRef, 'prng' | 'block_num'>, trx?: Trx): Promise<ValidatorEntry | null> {
        if (!this.watcher.validator) {
            return null;
        } else if (this.watcher.validator.paused_until_block > block.block_num) {
            return null;
        }

        const validators = await this.query(Validator_, trx)
            .where('is_active', true)
            .where('total_votes', '>', 0 as unknown as string)
            .orderBy('total_votes', 'desc')
            .orderBy('account_name')
            .getMany();
        const valid_validators = validators.map(ValidatorRepository.into);

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
