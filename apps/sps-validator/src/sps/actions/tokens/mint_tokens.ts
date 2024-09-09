import { AdminAction, AdminMembership, BalanceRepository, EventLog, MintManager, OperationData, Trx } from '@steem-monsters/splinterlands-validator';
import { mint_tokens } from '../schema';
import { MakeActionFactory, MakeRouter } from '../utils';

export class MintTokensAction extends AdminAction<typeof mint_tokens.actionSchema> {
    private static readonly MINTING_ACCOUNT = '$MINTING_ACCOUNT';
    readonly #mintManager: MintManager;
    constructor(
        op: OperationData,
        data: unknown,
        index: number,
        private readonly mintManager: MintManager,
        private readonly balanceRepository: BalanceRepository,
        adminMembership: AdminMembership,
    ) {
        super(adminMembership, mint_tokens, op, data, index);
        this.#mintManager = mintManager;
    }

    async process(trx?: Trx): Promise<EventLog[]> {
        const retval: EventLog[] = [];
        const tokens = this.#mintManager.tokens;

        // Only add the tokens that we don't have yet
        const existingTokens = new Set(Object.keys(tokens));
        const newTokens = this.params.mint.filter((v) => !existingTokens.has(v.entry.token)).map((v) => v.entry);
        if (newTokens.length !== 0) {
            retval.push(await this.#mintManager.mintTokens(newTokens, this, trx));
        }

        for (const perhapsPayout of this.params.mint) {
            if (perhapsPayout.payout === undefined) {
                continue;
            } else {
                const transfer = await this.balanceRepository.updateBalance(
                    this,
                    MintTokensAction.MINTING_ACCOUNT,
                    perhapsPayout.payout.beneficiary,
                    perhapsPayout.entry.token,
                    perhapsPayout.payout.qty,
                    'mint_token',
                    trx,
                );
                retval.push(...transfer);
            }
        }

        return retval;
    }
}

const Builder = MakeActionFactory(MintTokensAction, MintManager, BalanceRepository, AdminMembership);
export const Router = MakeRouter(mint_tokens.action_name, Builder);
