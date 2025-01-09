import { BaseRepository, EventLog, EventTypes, Handle, Trx } from '@steem-monsters/splinterlands-validator';
import { inject, injectable } from 'tsyringe';
import { ValidatorCheckInEntity } from '../tables';

@injectable()
export class SpsValidatorCheckInRepository extends BaseRepository {
    constructor(@inject(Handle) handle: Handle) {
        super(handle);
    }

    async getByAccount(account: string, trx?: Trx) {
        return this.query(ValidatorCheckInEntity, trx).where('account', account).getFirstOrUndefined();
    }

    async upsert(check_in: ValidatorCheckInEntity, trx?: Trx) {
        const record = await this.query(ValidatorCheckInEntity, trx)
            .useKnexQueryBuilder((query) => query.insert(check_in).onConflict(['account']).merge().returning('*'))
            .getFirst();

        return new EventLog(EventTypes.UPSERT, ValidatorCheckInEntity, record);
    }

    /**
     * Gets check ins that last checked in before the block_num
     */
    async countExpired(block_num: number, trx?: Trx) {
        const count = await this.query(ValidatorCheckInEntity, trx).where('last_check_in_block_num', '<', block_num).where('status', 'active').getCount();
        return Number(count);
    }

    /**
     * Gets check ins that last checked in before the block_num
     */
    async getExpired(block_num: number, trx?: Trx) {
        return this.query(ValidatorCheckInEntity, trx)
            .where('last_check_in_block_num', '<', block_num)
            .where('status', 'active')
            .orderBy('last_check_in_block_num', 'asc')
            .orderBy('account')
            .getMany();
    }

    async setInactive(account: string, trx?: Trx) {
        const record = await this.query(ValidatorCheckInEntity, trx).where('account', account).updateItemWithReturning({ status: 'inactive' });
        return new EventLog(EventTypes.UPDATE, ValidatorCheckInEntity, record);
    }
}
