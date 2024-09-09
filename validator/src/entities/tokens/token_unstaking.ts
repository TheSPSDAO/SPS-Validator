import { UnstakingWatch } from '../../config';
import { EventLog, EventTypes } from '../event_log';
import { IAction } from '../../actions/action';
import { BlockRef } from '../block';
import { BaseRepository, Trx, TokenUnstakingEntity, Handle } from '../../db/tables';
import { getTableName } from '@wwwouter/typed-knex';
import * as utils from '../../utils';
import { LogLevel } from '../../utils';
import { ProcessResult, VirtualPayloadSource } from '../../actions/virtual';
import { PrefixOpts } from '../operation';

type TokenUnstakingEntry = {
    player: string;
    unstake_tx: string;
    unstake_start_date: Date;
    is_active: boolean;
    token: string;
    total_qty: number;
    next_unstake_date: Date;
    total_unstaked: number;
    unstaking_periods: number;
    unstaking_interval_seconds: number;
    cancel_tx: string | null;
};

type EnrichedTokenUnstakingEntry = TokenUnstakingEntry & {
    unstake_amount: number;
};

export type TokenUnstakingStatic = {
    table: string;
} & VirtualPayloadSource;

export class TokenUnstakingRepository extends BaseRepository implements TokenUnstakingStatic {
    public readonly table = getTableName(TokenUnstakingEntity);

    constructor(handle: Handle, private readonly watcher: UnstakingWatch, private readonly cfg: PrefixOpts) {
        super(handle);
    }

    trx_id(block: BlockRef): string {
        return `sl_${this.table}_${block.block_num}`;
    }

    private static into(row: TokenUnstakingEntity): TokenUnstakingEntry {
        return {
            ...row,
            total_qty: parseFloat(row.total_qty),
            total_unstaked: parseFloat(row.total_unstaked),
        };
    }

    private static from(entry: TokenUnstakingEntry): TokenUnstakingEntity {
        return {
            ...entry,
            total_qty: String(entry.total_qty),
            total_unstaked: String(entry.total_unstaked),
        };
    }

    private static unstake_amount(entry: TokenUnstakingEntry): EnrichedTokenUnstakingEntry {
        // Calculate the total amount remaining to be unstaked
        const unstake_amount_remaining = +(entry.total_qty - entry.total_unstaked).toFixed(3);
        // Calculate the amount that should be unstaked each period
        const unstake_amount = Math.min(unstake_amount_remaining, +(entry.total_qty / entry.unstaking_periods).toFixed(3));
        return { ...entry, unstake_amount };
    }

    async lookup(player: string, token: string, trx?: Trx) {
        const record = await this.query(TokenUnstakingEntity, trx).where('player', player).where('token', token).where('is_active', true).getFirstOrNull();
        if (record) {
            return TokenUnstakingRepository.into(record);
        } else {
            return record;
        }
    }

    async insert(action: IAction, token: string, qty: number, trx?: Trx): Promise<EventLog[]> {
        //const pool = this.poolsHelper.poolByToken(token);
        //const validatedPoolSettings = pool && this.watcher.pools?.[pool.name];
        const unstakingSettings = this.watcher.unstaking?.get(token);
        if (!unstakingSettings) {
            utils.log(`Attempting to insert unstaking records while having misconfigured unstaking settings, ignoring.`, LogLevel.Error);
            return [];
        }

        const record = {
            player: action.op.account,
            unstake_tx: action.op.trx_op_id,
            unstake_start_date: action.op.block_time,
            is_active: true,
            token,
            total_qty: qty,
            next_unstake_date: new Date(action.op.block_time.getTime() + unstakingSettings.unstaking_interval_seconds * 1000),
            unstaking_periods: unstakingSettings.unstaking_periods,
            unstaking_interval_seconds: unstakingSettings.unstaking_interval_seconds,
            cancel_tx: null,
            // TODO: Missing in original code; where does this default come from?
            total_unstaked: 0,
        };
        const unstake_record = this.query(TokenUnstakingEntity, trx).insertItemWithReturning(TokenUnstakingRepository.from(record));
        return [new EventLog(EventTypes.INSERT, this, unstake_record)];
    }

    async cancel(action: IAction, token: string, trx?: Trx): Promise<EventLog> {
        const record = await this.query(TokenUnstakingEntity, trx).where('is_active', true).where('token', token).where('player', action.op.account).updateItemWithReturning({
            is_active: false,
            cancel_tx: action.op.trx_op_id,
        });
        if (record) {
            return new EventLog(EventTypes.UPDATE, TokenUnstakingEntity, TokenUnstakingRepository.into(record));
        } else {
            return new EventLog(EventTypes.UPDATE, TokenUnstakingEntity, record);
        }
    }

    async update(entry: EnrichedTokenUnstakingEntry, trx?: Trx): Promise<EventLog> {
        //const unstake_amount = //TokenUnstakingRepository.unstake_amount(entry);
        let update: any = {
            total_unstaked: entry.total_unstaked + entry.unstake_amount,
            next_unstake_date: new Date(entry.next_unstake_date.getTime() + entry.unstaking_interval_seconds * 1000),
        };

        // Check if the unstaking is completed
        if (entry.total_unstaked + entry.unstake_amount + 0.01 >= entry.total_qty) {
            update = {
                is_active: false,
                total_unstaked: entry.total_unstaked + entry.unstake_amount,
            };
        }

        const record = await this.query(TokenUnstakingEntity, trx).where('unstake_tx', entry.unstake_tx).updateItemWithReturning(update);
        return new EventLog(EventTypes.UPDATE, TokenUnstakingEntity, record);
    }

    async process(block: BlockRef, trx?: Trx): Promise<ProcessResult[]> {
        // Load all token unstaking records that need to be processed
        const unstaking_records = await this.query(TokenUnstakingEntity, trx)
            .where('is_active', true)
            .where('next_unstake_date', '<', block.block_time)
            .orderBy('next_unstake_date')
            .orderBy('unstake_tx')
            .getMany();

        // Create and return an array of Operations for each token unstaking record to be processed
        return unstaking_records.map((unstaking_record) => {
            return [
                'custom_json',
                {
                    required_auths: [unstaking_record.player],
                    required_posting_auths: [],
                    id: this.cfg.custom_json_id,
                    json: {
                        action: 'token_unstaking',
                        params: this.boundParams(unstaking_record),
                    },
                },
            ];
        });
    }

    private readonly boundFn = this.update.bind(this);

    // TODO: This needs to be thought over
    public boundParams(row: TokenUnstakingEntity) {
        const boundFn = this.boundFn;
        const entry = TokenUnstakingRepository.unstake_amount(TokenUnstakingRepository.into(row));
        return {
            ...entry,
            update: (trx?: Trx) => {
                return boundFn(entry, trx);
            },
        };
    }
}
