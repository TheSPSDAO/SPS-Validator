import {
    BalanceRepository,
    HiveAccountRepository,
    OperationData,
    Shop,
    Trx,
    Action,
    SaleTransfer,
    SaleReport,
    EventLog,
    ValidationError,
    ErrorType,
} from '@steem-monsters/splinterlands-validator';
import { ValidatorShop } from '../../utilities/validator-shop';
import { shop_purchase } from '../schema';
import { MakeActionFactory, MakeRouter } from '../utils';

export class ShopPurchaseAction extends Action<typeof shop_purchase.actionSchema> {
    protected sales: SaleTransfer[] = [];
    protected sale_report: SaleReport | undefined = undefined;

    constructor(
        op: OperationData,
        data: unknown,
        index: number,
        protected readonly balanceRepository: BalanceRepository,
        protected readonly hiveAccountRepository: HiveAccountRepository,
        protected readonly shop: Shop<Trx>,
    ) {
        super(shop_purchase, op, data, index);
    }

    override isSupported(): boolean {
        // Might still use unsupported tokens, but we can only find out later.
        return true;
    }

    async process(trx?: Trx) {
        const event_logs: EventLog[] = [];
        for (const transfer of this.sales) {
            const event_log = await this.balanceRepository.updateBalance(this, transfer.from, transfer.to, transfer.token, transfer.amount, this.action_name, trx);
            event_logs.push(...event_log);
        }

        if (this.sale_report) {
            event_logs.push(this.sale_report);
        }

        return event_logs;
    }

    async validate(trx?: Trx) {
        const calculated = await this.shop.precalculateSale(this.op.account, this.params, this, this.op.block.prng, trx);

        this.sales = calculated.result;
        this.sale_report = calculated.report;

        const accounts = this.sales.flatMap((st) => [st.to, st.from]).filter((s) => !s.startsWith('$'));
        const existingEscrowAccount = await this.hiveAccountRepository.onlyHiveAccounts(accounts, trx);

        if (!existingEscrowAccount) {
            throw new ValidationError('You transfer tokens from or to a non existing Hive account.', this, ErrorType.AccountNotKnown);
        }

        return true;
    }
}

const Builder = MakeActionFactory(ShopPurchaseAction, BalanceRepository, HiveAccountRepository, ValidatorShop);
export const Router = MakeRouter(shop_purchase.action_name, Builder);
