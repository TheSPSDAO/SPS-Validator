import { BaseRepository, Handle, Trx, ValidatorEntity as Validator_ } from '../../db/tables';
import { ValidatorWatch } from '../../config';
import { BlockRef } from '../block';
import { getTableName } from '@wwwouter/typed-knex';
import { EventLog, EventTypes } from '../event_log';
import { IAction } from 'validator/src/actions';

export type ValidatorEntry = {
    account_name: string;
    is_active: boolean;
    post_url: string | null;
    api_url: string | null;
    total_votes: number;
    missed_blocks: number;
    consecutive_missed_blocks?: number;
    reward_account: string | null;
    last_version: string | null;
};

/**
 * v1 = original entry format. no consecutive_missed_blocks field.
 * v2 = adds consecutive_missed_blocks field. this is used to track how many blocks in a row a validator has missed.
 */
export type ValidatorEntryVersion = 'v1' | 'v2';

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

    private static into(row: Validator_, version: ValidatorEntryVersion): ValidatorEntry {
        const entry = { ...row, total_votes: parseFloat(row.total_votes) } as ValidatorEntry;
        if (version === 'v1' && entry.consecutive_missed_blocks !== undefined) {
            delete entry.consecutive_missed_blocks;
        }
        return entry;
    }

    protected validatorEntryVersion(block_num: number): ValidatorEntryVersion {
        return 'v1';
    }

    public async register(params: { account: string; is_active: boolean; post_url?: string; reward_account?: string; api_url?: string }, action: IAction, trx?: Trx) {
        const record = await this.query(Validator_, trx)
            .useKnexQueryBuilder((query) =>
                query
                    .insert({
                        account_name: params.account,
                        is_active: params.is_active,
                        post_url: params.post_url ?? null,
                        reward_account: params.reward_account ?? null,
                        api_url: params.api_url ?? null,
                    })
                    .onConflict('account_name')
                    .merge()
                    .returning('*'),
            )
            .getFirstOrNull();
        return new EventLog(EventTypes.UPSERT, this, ValidatorRepository.into(record!, this.validatorEntryVersion(action.op.block_num)));
    }

    public async disable(account: string, action: IAction, trx?: Trx) {
        const record = await this.query(Validator_, trx).where('account_name', account).updateItemWithReturning({
            is_active: false,
        });
        return new EventLog(EventTypes.UPDATE, this, ValidatorRepository.into(record!, this.validatorEntryVersion(action.op.block_num)));
    }

    public async incrementMissedBlocks(account: string, increment: number, action: IAction, trx?: Trx) {
        const record = await this.query(Validator_, trx)
            .where('account_name', account)
            .useKnexQueryBuilder((query) => {
                query = query.increment('missed_blocks', increment);
                if (this.validatorEntryVersion(action.op.block_num) === 'v2') {
                    query = query.increment('consecutive_missed_blocks', increment);
                }
                return query;
            })
            .updateItemWithReturning({}, [
                'account_name',
                'missed_blocks',
                'is_active',
                'post_url',
                'total_votes',
                'reward_account',
                'api_url',
                'last_version',
                'consecutive_missed_blocks',
            ]);
        return [new EventLog(EventTypes.UPDATE, this, ValidatorRepository.into(record, this.validatorEntryVersion(action.op.block_num)))];
    }

    public async updateVersion(account: string, version: string, action: IAction, trx?: Trx) {
        const record = await this.query(Validator_, trx).where('account_name', account).updateItemWithReturning({
            last_version: version,
        });
        return [new EventLog(EventTypes.UPDATE, this, ValidatorRepository.into(record, this.validatorEntryVersion(action.op.block_num)))];
    }

    public async resetConsecutiveMissedBlocks(account: string, action: IAction, trx?: Trx) {
        const record = await this.query(Validator_, trx).where('account_name', account).updateItemWithReturning({
            consecutive_missed_blocks: 0,
        });
        return [new EventLog(EventTypes.UPDATE, this, ValidatorRepository.into(record, this.validatorEntryVersion(action.op.block_num)))];
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

    async lookup(account_name: string, block_num: number, trx?: Trx): Promise<ValidatorEntry | null> {
        const record = await this.query(Validator_, trx).where('account_name', account_name).getFirstOrNull();
        return record ? ValidatorRepository.into(record, this.validatorEntryVersion(block_num)) : null;
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
        const valid_validators = validators.map((v) => ValidatorRepository.into(v, this.validatorEntryVersion(block.block_num)));

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
