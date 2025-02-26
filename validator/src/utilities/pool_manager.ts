import { TokenWatch } from '../config';
import { AutonomousPoolConfiguration, AutonomousPoolError, AutonomousPoolsWrapper, determinePayout } from '../libs/pool';
import { ActionIdentifier, ErrorType } from '../entities/errors';
import { EventLog } from '../entities/event_log';
import { Trx } from '../db/tables';
import { BalanceRepository } from '../entities/tokens/balance';
import { IAction } from '../actions/action';

export interface PoolSerializer {
    store(pools: Array<AutonomousPoolConfiguration>, trx?: Trx): Promise<EventLog>;
}
export const PoolSerializer: unique symbol = Symbol('PoolSerializer');

export class PoolManager {
    private static readonly MINTING_ACCOUNT = '$MINTING_ACCOUNT';
    private static readonly CHANGE_KEY: unique symbol = Symbol('CHANGE_KEY');

    private wrapper?: AutonomousPoolsWrapper;

    constructor(private readonly serializer: PoolSerializer, watcher: TokenWatch, private readonly balanceRepository: BalanceRepository) {
        this.wrapper = AutonomousPoolsWrapper.create(watcher.token?.inflation_pools ?? []);
        watcher.removeTokenWatcher(PoolManager.CHANGE_KEY);
        watcher.addTokenWatcher(PoolManager.CHANGE_KEY, (value) => {
            this.wrapper = AutonomousPoolsWrapper.create(value?.inflation_pools ?? []);
        });
    }

    private storeSerialized(s: Array<AutonomousPoolConfiguration>, trx?: Trx) {
        return this.serializer.store(s, trx);
    }

    anyPools() {
        return this.wrapper?.anyPools() ?? false;
    }

    add(pool: AutonomousPoolConfiguration, aid: ActionIdentifier, trx?: Trx): Promise<EventLog> {
        if (this.wrapper === undefined) {
            throw new AutonomousPoolError(`Trying to add an autonomous pool while pool wrapper is not configured correctly.`, aid, ErrorType.AutonomousPoolInvalid);
        } else {
            this.wrapper.addPool(pool, aid);
            const serialized = this.wrapper.serialize();
            return this.storeSerialized(serialized, trx);
        }
    }

    update(pool: Partial<AutonomousPoolConfiguration>, aid: ActionIdentifier, trx?: Trx): Promise<EventLog> {
        if (this.wrapper === undefined) {
            throw new AutonomousPoolError(`Trying to update an autonomous pool while pool wrapper is not configured correctly.`, aid, ErrorType.AutonomousPoolInvalid);
        } else {
            // TODO: Should an update also execute a payout for the updated pool? If so, also pass a `now` argument.
            this.wrapper.updatePool(pool, aid);
            const serialized = this.wrapper.serialize();
            return this.storeSerialized(serialized, trx);
        }
    }

    // `aid` is an actual IAction, instead of a simple ActionIdentifier here, as that is what BalanceRepository uses.
    async payout(now: Date, aid: IAction, trx?: Trx) {
        if (this.wrapper === undefined) {
            throw new AutonomousPoolError(`Trying to payout autonomous pools while pool wrapper is not configured correctly.`, aid, ErrorType.AutonomousPoolInvalid);
        } else {
            const retval: EventLog[] = [];
            const paidPools: Partial<AutonomousPoolConfiguration>[] = [];
            await this.wrapper.poolCallback(async (pool) => {
                const payout = determinePayout(pool, now);
                if (payout !== undefined) {
                    paidPools.push({ name: pool.name, lastPayout: now });
                    if (payout.amount > 0) {
                        retval.push(
                            ...(await this.balanceRepository.updateBalance(
                                aid,
                                PoolManager.MINTING_ACCOUNT,
                                payout.beneficiary,
                                payout.token,
                                payout.amount,
                                `INFLATION_POOL_MINT_${pool.name.toUpperCase()}`,
                                trx,
                            )),
                        );
                    }
                }
            });

            for (const update of paidPools) {
                this.wrapper.updatePool(update, aid);
            }

            if (paidPools.length > 0) {
                const serialized = this.wrapper.serialize();
                retval.push(await this.storeSerialized(serialized, trx));
            }
            return retval;
        }
    }
}
