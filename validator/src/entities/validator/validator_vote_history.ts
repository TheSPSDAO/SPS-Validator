import { EventLog, EventTypes } from '../event_log';
import { IAction } from '../../actions/action';
import { BaseRepository, ValidatorVoteHistoryEntity, Trx, Handle } from '../../db/tables';

export class ValidatorVoteHistoryRepository extends BaseRepository {
    constructor(handle: Handle) {
        super(handle);
    }
    async insert(action: IAction, is_approval: boolean, vote_weight: number, trx?: Trx): Promise<EventLog> {
        // TODO: fix this
        const validator = action.params?.account_name as string;
        const record = await this.query(ValidatorVoteHistoryEntity, trx).insertItemWithReturning({
            transaction_id: action.op.trx_op_id,
            created_date: action.op.block_time,
            voter: action.op.account,
            validator,
            is_approval,
            vote_weight: String(vote_weight),
        });

        return new EventLog(EventTypes.INSERT, ValidatorVoteHistoryEntity, record);
    }
}
