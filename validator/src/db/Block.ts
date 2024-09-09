export type Block = {
    block_num: number;
    block_id: string;
    prev_block_id: string;
    l2_block_id: string;
    block_time: Date;
    validator: string | null;
    validation_tx: string | null;
};
