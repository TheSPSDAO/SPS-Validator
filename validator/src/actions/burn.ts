import { ProcessResult, VirtualPayloadSource } from './virtual';
import { BlockRef } from '../entities/block';
import { Trx } from '../db/tables';
import { BalanceRepository } from '../entities/tokens/balance';
import { PrefixOpts } from '../entities/operation';

export type BurnOpts = {
    burn_account: string; // 'null'
    burned_ledger_account: string; // '$NULL_CLEARED
};
export const BurnOpts: unique symbol = Symbol('BurnOpts');

export class ClearBurnedTokensSource implements VirtualPayloadSource {
    constructor(private readonly prefixOpts: PrefixOpts, private readonly burnOpts: BurnOpts, private readonly balanceRepo: BalanceRepository) {}

    async process(block: BlockRef, trx?: Trx): Promise<ProcessResult[]> {
        const payloads = await this.payloads(trx);
        if (payloads.length === 0) {
            return [];
        }
        return [
            [
                'custom_json',
                {
                    required_auths: [this.burnOpts.burn_account],
                    required_posting_auths: [],
                    id: this.prefixOpts.custom_json_id,
                    json: payloads,
                },
            ],
        ];
    }

    trx_id(block: BlockRef): string {
        return `clear_burned_${block.block_num}@${block.block_time.getTime()}`;
    }

    async payloads(trx?: Trx) {
        const balances = await this.balanceRepo.getBalances(this.burnOpts.burn_account, trx);

        return balances
            .filter((e) => e.balance > 0)
            .map((e) => {
                return {
                    action: 'burn',
                    params: {
                        account: this.burnOpts.burn_account,
                        to: this.burnOpts.burned_ledger_account,
                        token: e.token,
                        qty: e.balance,
                    },
                };
            });
    }
}
