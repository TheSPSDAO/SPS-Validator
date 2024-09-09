import { BlockRef } from '../entities/block';
import { Trx } from '../db/tables';

export type ProcessResult = [
    'custom_json',
    {
        required_auths: string[];
        required_posting_auths: string[];
        id: string;
        json: any;
    },
];

export interface VirtualPayloadSource {
    process(block: BlockRef, trx?: Trx): Promise<ProcessResult[]>;
    trx_id(block: BlockRef): string;
}
type WrappedPayload = { trx_id: string; payloads: ProcessResult[] };
export const TopLevelVirtualPayloadSource: unique symbol = Symbol('TopLevelVirtualPayloadSource');
export interface TopLevelVirtualPayloadSource {
    process(block: BlockRef, trx?: Trx): Promise<WrappedPayload[]>;
}

//const trx_id = `sl_${this.tokenUnstakingRepository.table}_${block.block_num}`;
export class BasePayloadSourceWrapper implements TopLevelVirtualPayloadSource {
    private readonly sources: VirtualPayloadSource[];
    constructor(...sources: VirtualPayloadSource[]) {
        this.sources = sources;
    }

    async process(block: BlockRef, trx?: Trx) {
        const results: Array<WrappedPayload> = [];
        for (const source of this.sources) {
            results.push({ trx_id: source.trx_id(block), payloads: await source.process(block, trx) });
        }
        return results;
    }
}
