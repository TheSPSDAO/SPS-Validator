import { Prime } from '../utilities/traits';
import { Trx } from '../db/tables';
import { Watcher } from '../config';
import { log, LogLevel } from '../utils';

export const Bookkeeping: unique symbol = Symbol('bookkeeping');

export interface Bookkeeping {
    is_bookkeeping_account(account: string): boolean;
}

export type BookkeepingConfig = {
    accounts: string[];
};

export type BookkeepingWatch = Watcher<'bookkeeping', BookkeepingConfig>;
export const BookkeepingWatch: unique symbol = Symbol('BookkeepingWatch');
export enum BookkeepingDefault {
    NONE = 0,
    DOLLAR_ONLY = 1,
}

function evaluate_set(s: Set<string>): (account: string) => boolean {
    return (account: string) => s.has(account);
}

function evaluate_dollar(): (account: string) => boolean {
    return (account) => account.startsWith('$');
}

export class BookkeepingFromConfig implements Bookkeeping, Prime {
    constructor(private readonly watcher: BookkeepingWatch, private readonly default_mode: BookkeepingDefault) {
        this.set_evaluator(new Set());
    }

    private static readonly UPDATE_BOOKKEEPING: unique symbol = Symbol('Bookkeeping');
    private evaluator: (account: string) => boolean = () => false;

    private set_evaluator(accounts: Set<string>) {
        switch (this.default_mode) {
            case BookkeepingDefault.DOLLAR_ONLY:
                this.evaluator = accounts.size === 0 ? evaluate_dollar() : evaluate_set(accounts);
                break;
            case BookkeepingDefault.NONE:
                this.evaluator = evaluate_set(accounts);
                break;
        }
    }

    private register(config?: BookkeepingConfig) {
        const accounts = new Set(config?.accounts ?? []);

        if (accounts.size === 0) {
            log(`0 Bookkeeping accounts configured with mode ${BookkeepingDefault[this.default_mode]}`, LogLevel.Warning);
        }

        this.set_evaluator(accounts);
    }

    is_bookkeeping_account(account: string): boolean {
        return this.evaluator(account);
    }

    prime(_trx?: Trx): Promise<void> {
        this.watcher.removeBookkeepingWatcher(BookkeepingFromConfig.UPDATE_BOOKKEEPING);
        this.watcher.addBookkeepingWatcher(BookkeepingFromConfig.UPDATE_BOOKKEEPING, this.register.bind(this));
        this.register(this.watcher.bookkeeping);

        return Promise.resolve();
    }
}
