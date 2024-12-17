import { inject, injectable } from 'tsyringe';
import { BalanceRepository, BlockRef, PrefixOpts, ProcessResult, Trx, VirtualPayloadSource } from '@steem-monsters/splinterlands-validator';

export type BurnOpts = {
    burn_account: string; // 'null'
    burned_ledger_account: string; // '$NULL_CLEARED
};
export const BurnOpts: unique symbol = Symbol('BurnOpts');

@injectable()
export class SpsClearBurnedTokensSource implements VirtualPayloadSource {
    constructor(
        @inject(PrefixOpts) private readonly prefixOpts: PrefixOpts,
        @inject(BurnOpts) private readonly burnOpts: BurnOpts,
        @inject(BalanceRepository) private readonly balanceRepo: BalanceRepository,
    ) {}

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
