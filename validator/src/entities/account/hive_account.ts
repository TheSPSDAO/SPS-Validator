import { BaseRepository, Handle, HiveAccountEntity, Trx } from '../../db/tables';
import { isSystemAccount } from '../../utilities/accounts';
import { EventLog, EventTypes } from '../event_log';

type Authority = Record<string, string[]>;

export class HiveAccountRepository extends BaseRepository {
    constructor(handle: Handle) {
        super(handle);
    }

    public upsert(payload: HiveAccountEntity, trx?: Trx) {
        // This is currently a ridiculous upsert operation, since HiveAccount only has one column.
        return this.query(HiveAccountEntity, trx)
            .useKnexQueryBuilder((query) => query.insert(payload).onConflict('name').merge())
            .execute();
    }

    public async setAuthority(account: string, authority: Authority, trx?: Trx) {
        const result = await this.query(HiveAccountEntity, trx).where('name', account).updateItemWithReturning({ authority });
        return new EventLog(EventTypes.UPDATE, HiveAccountEntity, result);
    }

    public async checkAuthority(actor: string, auth: string, account: string, trx?: Trx) {
        if (actor === account) {
            return true;
        }

        const result = await this.query(HiveAccountEntity, trx).where('name', account).getSingleOrNull();
        if (!result) {
            return false;
        }

        const accounts = result.authority[auth];
        return accounts && accounts.includes(actor);
    }

    public async onlyHiveAccounts(names: string[], trx?: Trx): Promise<boolean> {
        const set = new Set(names);
        const count = await this.query(HiveAccountEntity, trx)
            .orWhereIn('name', [...set])
            .getCount();
        const expected = typeof count === 'number' ? set.size : BigInt(set.size);
        return count === expected;
    }

    public onlySystemAccounts(names: string[]): boolean {
        const set = new Set(names);
        const count = [...set].filter(isSystemAccount).length;
        return count === set.size;
    }

    public async onlyHiveOrSystemAccounts(names: string[], trx?: Trx): Promise<boolean> {
        const [potentialSystemAccountNames, potentialHiveAccountNames] = names.reduce<[string[], string[]]>(
            (collector, x) => {
                x.startsWith('$') ? collector[0].push(x) : collector[1].push(x);
                return collector;
            },
            [[], []],
        );

        return this.onlySystemAccounts(potentialSystemAccountNames) && (await this.onlyHiveAccounts(potentialHiveAccountNames, trx));
    }
}
