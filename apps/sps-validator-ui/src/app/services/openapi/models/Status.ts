/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

export type Status = {
    status: Status.status;
    last_block: {
        block_num: number;
        block_id: string;
        prev_block_id: string;
        l2_block_id: string;
        block_time: string;
        validator: string | null;
        validator_tx: string | null;
    };
}

export namespace Status {

    export enum status {
        RUNNING = 'running',
    }


}
