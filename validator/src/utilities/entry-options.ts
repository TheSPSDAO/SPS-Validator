export const EntryOptions: unique symbol = Symbol('EntryOptions');
export type EntryOptions = {
    block_processing: boolean;
    start_block: string | null;
};
