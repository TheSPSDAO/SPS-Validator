import { BlockRef } from './block';
import { Trx } from '../db/tables';
import { ProcessResult, VirtualPayloadSource } from '../actions/virtual';
import { PrefixOpts } from './operation';

export class PoolClaimPayloads implements VirtualPayloadSource {
    private static pool_payload_account = '$MINTING';

    constructor(private readonly cfg: PrefixOpts) {}
    async process(block: BlockRef, _?: Trx): Promise<ProcessResult[]> {
        const now = block.block_time;
        return [
            [
                'custom_json',
                {
                    required_auths: [PoolClaimPayloads.pool_payload_account],
                    required_posting_auths: [],
                    id: this.cfg.custom_json_id,
                    json: {
                        action: 'claim_pool',
                        params: { now },
                    },
                },
            ],
        ];
    }

    trx_id(block: BlockRef): string {
        return `claim_${block.block_num}@${block.block_time.getTime()}`;
    }
}
