import { Column, ITypedQueryBuilder, Table, TypedKnex } from '@wwwouter/typed-knex';
import type { Knex } from 'knex';
import { knex } from 'knex';

// Activate implicit type mappings
import './config/mapping';
import { TransactionMode } from './transaction';
import type { JSONB, SerialIntKey } from './columns';

export { validateTables } from '@wwwouter/typed-knex';

export type RawResult<T> = {
    rows: T[];
    rowCount: number;
};

export type Handle = TypedKnex & {
    // shortcut to knex instance instead of injecting it.
    knexInstance: Knex;
};
export const Handle: unique symbol = Symbol.for('Handle');

export type Trx = Knex.Transaction & {
    mode?: TransactionMode;
    readOnly?: boolean;
};
export type Query<T> = ITypedQueryBuilder<T, T, T>;

export class BaseRepository {
    // Protected because reflection does not work cleanly with inherited constructors
    protected constructor(private readonly handle: Handle) {}
    protected query<T>(tableClass: new () => T, trx?: Trx): Query<T> {
        const query = this.handle.query(tableClass);
        if (trx) {
            return query.transacting(trx);
        } else {
            return query;
        }
    }

    protected queryRaw(trx?: Trx): Knex {
        if (trx) {
            return trx;
        } else {
            return this.handle.knexInstance;
        }
    }
}

export type DB_Connection = {
    host: string;
    port: number;
    password: string;
    user: string;
    database: string;
};

export type KnexOptions = {
    db_connection: Partial<DB_Connection>;
    db_schema: string | null;
};

export const KnexToken: unique symbol = Symbol.for('Knex');

export function freshKnex(opts: KnexOptions) {
    if (opts.db_schema) {
        return knex({ client: 'pg', connection: opts.db_connection, searchPath: opts.db_schema });
    } else {
        return knex({ client: 'pg', connection: opts.db_connection });
    }
}

// TypedKnex does not support composite primary keys
@Table('balances')
export class BalanceEntity {
    @Column() public player!: string;
    @Column() public token!: string;
    @Column() public balance = '0'; // numeric(15, 3)
}

@Table('balance_history')
export class BalanceHistoryEntity {
    @Column() public player!: string;
    @Column() public token!: string;
    @Column() public amount!: string; // numeric(12, 3)
    @Column() public balance_start!: string; // numeric(15, 3)
    @Column() public balance_end!: string; // numeric(15, 3)
    @Column() public block_num!: number;
    @Column() public trx_id!: string;
    @Column() public type!: string;
    @Column() public created_date!: Date;
    @Column() public counterparty!: string | null;
}

@Table('active_delegations')
export class ActiveDelegationEntity {
    @Column() public token!: string;
    @Column() public delegator!: string;
    @Column() public delegatee!: string;
    @Column() public amount!: string;
    @Column() public last_delegation_tx!: string;
    @Column() public last_delegation_date!: Date;
    @Column() public last_undelegation_date!: Date | null;
    @Column() public last_undelegation_tx!: string | null;
}

@Table('blocks')
export class BlockEntity {
    @Column({ primary: true }) public block_time!: Date;
    @Column() public block_num!: number;
    @Column() public block_id!: string;
    @Column() public prev_block_id!: string;
    @Column() public l2_block_id!: string;
    @Column() public validator!: string | null;
    @Column() public validation_tx!: string | null;
}

@Table('config')
export class ConfigEntity {
    @Column() public group_name!: string;
    @Column() public group_type!: string;
    @Column() public name!: string;
    @Column() public index = 0;
    @Column() public value_type!: string;
    @Column() public value!: string | null;
    @Column() public last_updated_date!: Date | null;
    @Column() public last_updated_tx!: string | null;
}

@Table('hive_accounts')
export class HiveAccountEntity {
    @Column({ primary: true }) public name!: string;
    @Column() public authority!: Record<string, string[]>;
}

@Table('price_history')
export class PriceHistoryEntity {
    @Column() public validator!: string;
    @Column() public token!: string;
    @Column() public block_num!: number;
    @Column() public block_time!: Date;
    @Column() public token_price!: string; // numeric(12, 6)
}

@Table('staking_pool_reward_debt')
export class StakingPoolRewardDebtEntity {
    @Column({ primary: true }) public player!: string;
    @Column({ primary: true }) public pool_name!: string;
    @Column() public reward_debt!: string; // numeric(15, 3)
}

@Table('token_unstaking')
export class TokenUnstakingEntity {
    @Column() public player!: string;
    @Column({ primary: true }) public unstake_tx!: string;
    @Column() public unstake_start_date!: Date;
    @Column() public is_active!: boolean;
    @Column() public token!: string;
    @Column() public total_qty!: string; // numeric(15, 3)
    @Column() public next_unstake_date!: Date;
    @Column() public total_unstaked!: string; // numeric(15, 3)
    @Column() public unstaking_periods!: number;
    @Column() public unstaking_interval_seconds!: number;
    @Column() public cancel_tx!: string | null;
}

export type PromiseStatus = 'open' | 'fulfilled' | 'completed' | 'cancelled';

@Table('promise')
export class PromiseEntity {
    @Column() public id!: SerialIntKey;
    @Column() public ext_id!: string;
    @Column() public type!: string;
    @Column() public status!: PromiseStatus;
    @Column() public params!: JSONB;
    @Column() public controllers!: string[];
    @Column() public fulfill_timeout_seconds: number | null = null;
    @Column() public fulfilled_by: string | null = null;
    @Column() public fulfilled_at: Date | null = null;
    @Column() public fulfilled_expiration: Date | null = null;
    @Column() public created_date!: Date;
    @Column() public updated_date!: Date;
}

export type PromiseAction = 'create' | 'complete' | 'cancel' | 'fulfill' | 'reverse';

@Table('promise_history')
export class PromiseHistoryEntity {
    @Column() public id!: SerialIntKey;
    @Column() public promise_id!: SerialIntKey;
    @Column() public player!: string;
    @Column() public action!: PromiseAction;
    @Column() public previous_status!: PromiseStatus | null;
    @Column() public new_status!: PromiseStatus;
    @Column() public trx_id!: string;
    @Column() public created_date!: Date;
}

@Table('validator_transaction_players')
export class TransactionPlayerEntity {
    @Column() public transaction_id!: string;
    @Column() public player!: string;
}

@Table('validator_transactions')
export class TransactionEntity {
    @Column({ primary: true }) public id!: string;
    @Column() public block_id!: string;
    @Column() public prev_block_id!: string;
    @Column() public type!: string;
    @Column() public player!: string;
    @Column() public data!: string | null;
    @Column() public success!: boolean | null;
    @Column() public error!: string | null;
    @Column() public block_num!: number | null;
    @Column() public index!: number | null;
    @Column() public created_date!: Date | null;
    @Column() public result!: string | null;
}

@Table('validator_vote_history')
export class ValidatorVoteHistoryEntity {
    @Column({ primary: true }) public transaction_id!: string;
    @Column() public created_date!: Date;
    @Column() public voter!: string;
    @Column() public validator!: string;
    @Column() public is_approval!: boolean;
    @Column() public vote_weight!: string; // numeric(12, 3)
}

@Table('validator_votes')
export class ValidatorVoteEntity {
    @Column({ primary: true }) public voter!: string;
    @Column({ primary: true }) public validator!: string;
    @Column() public vote_weight!: string; // numeric(12, 3)
}

@Table('validators')
export class ValidatorEntity {
    @Column({ primary: true }) public account_name!: string;
    @Column() public is_active!: boolean;
    @Column() public post_url!: string | null;
    @Column() public total_votes = '0'; // numeric(12, 3)
    @Column() public missed_blocks = 0;
    @Column() public reward_account!: string | null;
}
