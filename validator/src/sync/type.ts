export type SynchronisationConfig = unknown[]; // unknown tuple
export interface SynchronisationPoint<T extends SynchronisationConfig> {
    waitToProcessBlock(block_num: number, ...args: T): Promise<void>;
}
