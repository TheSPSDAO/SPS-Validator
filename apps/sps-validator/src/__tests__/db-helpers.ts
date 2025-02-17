import { OpsHelper } from './process-op';
import {
    Handle,
    ValidatorEntity,
    ValidatorVoteEntity,
    BalanceEntity,
    BaseRepository,
    Trx,
    TokenUnstakingEntity,
    ConfigEntity,
    PriceHistoryEntity,
    BlockEntity,
    TransactionEntity,
    HiveAccountEntity,
    ActiveDelegationEntity,
    ShopTokenConfig,
} from '@steem-monsters/splinterlands-validator';
import { inject, injectable } from 'tsyringe';
import { SpsConfigLoader } from '../sps/config';
import { BalanceHistoryEntity, PromiseEntity, PromiseHistoryEntity } from 'validator/src/db/tables';
import { TOKENS } from '../sps/features/tokens';
import { ValidatorCheckInEntity } from '../sps/entities/tables';

@injectable()
export class TestHelper extends BaseRepository {
    constructor(@inject(Handle) handle: Handle, @inject(OpsHelper) private readonly helper: OpsHelper) {
        super(handle);
    }

    async insertDefaultConfiguration(trx?: Trx) {
        for (const [key, val] of Object.entries(SpsConfigLoader.DEFAULT)) {
            for (const [key_, val_] of Object.entries(val)) {
                const payload = {
                    group_name: key,
                    group_type: 'object',
                    name: key_,
                    index: 0,
                    value_type: 'object', // HACK, yet works for everything we have
                    value: JSON.stringify(val_),
                };

                await this.query(ConfigEntity, trx).insertItem(payload);
            }
        }
    }

    insertDummyValidator(account_name: string, is_active = true, total_votes = 0, reward_account: string | null = null, trx?: Trx) {
        return this.query(ValidatorEntity, trx).insertItem({
            account_name,
            is_active,
            total_votes: String(total_votes),
            missed_blocks: 0,
            reward_account,
        });
    }

    insertDummyVote(voter: string, validator: string, trx?: Trx) {
        return this.query(ValidatorVoteEntity, trx).insertItem({
            voter,
            validator,
            vote_weight: String(1),
        });
    }

    votesForValidator(validator: string, trx?: Trx) {
        return this.query(ValidatorVoteEntity, trx).where('validator', validator).getMany();
    }

    async getDummyToken(account_name: string, token = TOKENS.SPS, trx?: Trx) {
        const result = await this.query(BalanceEntity, trx).where('player', account_name).where('token', token).getFirstOrNull();
        if (result) {
            return { ...result, balance: parseFloat(result.balance) };
        } else {
            return null;
        }
    }

    setDummyToken(account_name: string, amount: number, token = TOKENS.SPS, trx?: Trx) {
        return this.query(BalanceEntity, trx).insertItem({ player: account_name, balance: String(amount), token });
    }

    setMintedBalance(system_account_name: string, amount: number, token = TOKENS.SPS, trx?: Trx) {
        if (amount >= 0 || isNaN(amount)) {
            throw new Error(`Amount must be smaller than 0`);
        }
        if (!system_account_name.startsWith('$')) {
            throw new Error(`System account must start with $`);
        }
        return this.query(BalanceEntity, trx).insertItem({ player: system_account_name, balance: String(amount), token });
    }

    setStaked(account: string, amount: number, trx?: Trx) {
        return this.setDummyToken(account, amount, TOKENS.SPSP, trx);
    }

    setDelegatedOut(account: string, amount: number, trx?: Trx) {
        return this.setDummyToken(account, amount, TOKENS.SPSP_OUT, trx);
    }

    setDelegatedIn(account: string, amount: number, trx?: Trx) {
        return this.setDummyToken(account, amount, TOKENS.SPSP_IN, trx);
    }

    setLiquidSPSBalance(account: string, amount: number) {
        return this.setDummyToken(account, amount, TOKENS.SPS);
    }

    insertExistingAdmins(admins: string[], trx?: Trx) {
        const payload: Partial<ConfigEntity> = {
            group_name: '$root',
            group_type: 'object',
            name: 'admin_accounts',
            index: 0,
            value_type: 'array',
            value: JSON.stringify(admins),
        };
        return this.query(ConfigEntity, trx)
            .useKnexQueryBuilder((query) => query.insert(payload).onConflict(['group_name', 'name']).merge())
            .execute();
    }

    getUnstakingRecord(account: string, trx?: Trx) {
        return this.query(TokenUnstakingEntity, trx).where('player', account).where('token', TOKENS.SPS).where('is_active', true).getFirstOrNull();
    }

    getActiveDelegationRecord(delegator: string, delegatee: string, token: string, trx?: Trx) {
        return this.query(ActiveDelegationEntity, trx).where('delegator', delegator).where('delegatee', delegatee).where('token', token).getFirstOrNull();
    }

    setActiveDelegationRecord(delegator: string, delegatee: string, token: string, amount: number, trx?: Trx) {
        return this.helper.processOp(
            'delegate_tokens',
            delegator,
            {
                token: token,
                to: delegatee,
                qty: amount,
            },
            { trx: trx },
        );
    }

    // This can be done more cleanly by using the database directly, but this is currently quite coupled with Actions.
    // TODO: Rework this after the move the (Typed-)Knex.
    async setUnstakingRecord(account: string, amount: number, trx?: Trx) {
        await this.setStaked(account, amount, trx);
        return this.helper.processOp(
            'unstake_tokens',
            account,
            {
                token: TOKENS.SPS,
                qty: amount,
            },
            { trx: trx },
        );
    }

    async lookupPriceFeedRecord(validator: string, token: string, trx?: Trx) {
        return this.query(PriceHistoryEntity, trx).where('validator', validator).where('token', token).getFirstOrNull();
    }

    insertDummyBlock(block_num: number, hash: string, validator: string, validation_tx: string | null = null, trx?: Trx) {
        const block_id = '7331';
        const prev_block_id = '7330';
        return this.query(BlockEntity, trx).insertItem({
            block_num,
            block_id,
            prev_block_id,
            l2_block_id: hash,
            block_time: new Date(),
            validator,
            validation_tx,
        });
    }

    blockForBlockNumber(block_num: number, trx?: Trx) {
        return this.query(BlockEntity, trx).where('block_num', block_num).getFirstOrNull();
    }

    async insertBlocksAndTransaction(blocks: BlockEntity[] = example_blocks, transactions: TransactionEntity[] = example_transactions) {
        await this.query(TransactionEntity).insertItems(transactions);
        await this.query(BlockEntity).insertItems(blocks);
    }

    async setHiveAccount(name: string, authority?: Record<string, string[]>, trx?: Trx) {
        await this.query(HiveAccountEntity, trx).insertItem({ name, authority: authority ?? {} });
    }

    insertShopConfig(id: string, data: ShopTokenConfig, trx?: Trx) {
        return this.query(ConfigEntity, trx).insertItem({
            group_name: 'shop',
            name: id,
            group_type: 'object',
            value_type: 'object',
            index: 0,
            last_updated_date: null,
            last_updated_tx: null,
            value: JSON.stringify(data),
        });
    }

    insertBalanceHistory(player: string, token: string, history: { date: Date; balance: string }[], trx?: Trx) {
        return this.query(BalanceHistoryEntity, trx).insertItems(
            history.map((entry) => ({
                player,
                token,
                amount: entry.balance,
                balance_start: entry.balance,
                balance_end: entry.balance,
                block_num: 0,
                trx_id: 'dummy',
                type: 'dummy',
                created_date: entry.date,
                counterparty: null,
            })),
        );
    }

    insertCheckIn(check_in: ValidatorCheckInEntity, trx?: Trx) {
        return this.query(ValidatorCheckInEntity, trx).insertItem(check_in);
    }

    getCheckIn(account: string, trx?: Trx) {
        return this.query(ValidatorCheckInEntity, trx).where('account', account).getSingleOrNull();
    }

    getHiveAccount(account: string, trx?: Trx) {
        return this.query(HiveAccountEntity, trx).where('name', account).getSingleOrNull();
    }

    insertPromise(promise: Omit<PromiseEntity, 'id'>, trx?: Trx) {
        return this.query(PromiseEntity, trx).insertItem(promise);
    }

    getPromise(type: string, id: string, trx?: Trx) {
        return this.query(PromiseEntity, trx).where('type', type).where('ext_id', id).getSingleOrNull();
    }

    getPromiseHistory(promise_id: number, trx?: Trx) {
        return this.query(PromiseHistoryEntity, trx).where('promise_id', promise_id).getMany();
    }

    countPromises(trx?: Trx) {
        return this.query(PromiseEntity, trx).count('ext_id', 'count').getSingle();
    }
}

export const emoji_payload =
    '🍮🌖🐶💰🔪🐃 📼💉🍉👺 🕦💨🍶🔁🍯🐠 🌐📢🍼📎👻📵 🍁🌚💉📛🍶📀🔠🔥 🎹💀🐸🍂🐾🔼 🕟🔀🔐🔢 🏄🎢👈🍹👚🎥 🗽👢🐽🌘💃🌁💎 ' +
    '🍱💹🔘🍥. 🔺🎷💫👍🔴🔌 👋🎂👅💆🐟🏡 🕖🎓🌂🏠🍵 🌹🔳💅📟🕥👩 🎑🌙👸💠🍖🔺🌅 📧🔍🕓🌸👌 👅💅🍴📮📋🏈 💪🏭💾🌠🏈 🎵🔌🐯💋' +
    '🎪 🔀🔈📟🐯🐨🍀🍙 🌅🐬🐽🍀 💇🌷🍠🏢📂💄. 🍜🎮👛🐾🐴 🍂🎅👎🍶🐕 🐪🔘🐀🕀📟 👩🔁📢🐏👽🎥💊💇 🍎💽🕐💆🕂 📗👺🔈🎇 🐺🐑💽' +
    '🏀🍊🕃 🎧📷📀🔣🔟 📫👥🍆🐖 📁🕘🐦👤 👲🍎🌑👻🐢🎡🐗 🍔🍢🎰💕🐙🌕 🎦🐬📣🏊🍅 🏀🐆🔞🔊🕠💹. 🎭👂💩📔🌵🔁 🕝🐣🕔📵💲 🏰📥🍳' +
    '💒🔑🍤📴 🏨💕🐪🕗 🕕👔🎬👒🕞 🐣👺📊👨🕦🌘 👼🐅🌺🍏🍐🐦🔦 👚🐢📥🔁🐌 🔭🍈🌝🍏🍡 👩🔇🔷📼 👬🍒🎡💨🔒 👃🌕🔕🌺🐇🌲' +
    '🌰🍡🐍🐕📋 👆🕠🍻📍 🍎👷📧🔇🍅🎣🎃 🎐💛🎣🐷🍞 🌳🕚🔧🍄🍥🌹 🐚👼🏫👋🗼 🕟📍👼📟💮🕣👇 🌷🔅💬🐵🎤💣 👔💱💅🌑🕓🐩🔻 👟💗🔩';

export const garbage_payload = { value: 'bagels_are_not_booleans' };

export const example_transactions: TransactionEntity[] = [
    {
        id: 'A',
        block_id: 'B',
        prev_block_id: 'A',
        type: 'token_transfer',
        player: 'tehbone',
        data: JSON.stringify({ memo: 'cool beans', token: 'SPS', qty: 0.5, from: 'tehbone', to: 'steemmonsters', success: true }),
        success: true,
        error: null,
        block_num: 1,
        index: 0,
        created_date: null,
        result: null,
    },
    {
        id: 'B',
        block_id: 'C',
        prev_block_id: 'B',
        type: 'token_transfer',
        player: 'tehbone',
        data: JSON.stringify({ memo: 'cool beans', token: 'SPS', qty: 0.4, from: 'tehbone', to: 'steemmonsters', success: true }),
        success: true,
        error: null,
        block_num: 2,
        index: 0,
        created_date: null,
        result: null,
    },
    {
        id: 'C',
        block_id: 'D',
        prev_block_id: 'C',
        type: 'token_transfer',
        player: 'tehbone',
        data: JSON.stringify({ memo: 'cool beans', token: 'SPS', qty: 0.3, from: 'tehbone', to: 'steemmonsters', success: true }),
        success: true,
        error: null,
        block_num: 3,
        index: 0,
        created_date: null,
        result: null,
    },
    {
        id: 'D',
        block_id: 'B',
        prev_block_id: 'A',
        type: 'unstake_tokens',
        player: 'tehbone',
        data: JSON.stringify({ qty: '10', token: 'SPS' }),
        success: true,
        error: null,
        block_num: 1,
        index: 1,
        created_date: null,
        result: null,
    },
];

export const example_blocks: BlockEntity[] = [
    {
        block_num: 1,
        block_id: 'B',
        prev_block_id: 'A',
        l2_block_id: 'A',
        validator: 'test',
        validation_tx: 'test',
        block_time: new Date(),
    },
    {
        block_num: 2,
        block_id: 'C',
        prev_block_id: 'B',
        l2_block_id: 'B',
        validator: 'test',
        validation_tx: 'test',
        block_time: new Date(),
    },
];
