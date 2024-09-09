import { ConfigLoader, TokenWatch } from '../config';
import { AutonomousPoolError } from '../libs/pool';
import { ActionIdentifier, ErrorType } from '../entities/errors';
import { EventLog } from '../entities/event_log';
import { Trx } from '../db/tables';
import { AutonomousMint, MintConfiguration } from '../libs/mint';
import { TokenSupport, WrappedTokenSupport } from './token_support';

export class MintManager implements WrappedTokenSupport {
    private readonly CHANGE_KEY = Symbol('CHANGE_KEY');

    private mint?: AutonomousMint;
    #tokens?: TokenSupport;

    constructor(private readonly base: TokenSupport, private readonly loader: ConfigLoader, watcher: TokenWatch) {
        this.mint = AutonomousMint.create(this.base, watcher.token?.token_records ?? []);
        this.#tokens = this.mint?.tokens;
        watcher.removeTokenWatcher(this.CHANGE_KEY);
        watcher.addTokenWatcher(this.CHANGE_KEY, (value) => {
            this.mint = AutonomousMint.create(this.base, value?.token_records ?? []);
            this.#tokens = this.mint?.tokens;
        });
    }

    private storeSerialized(s: Array<MintConfiguration>, trx?: Trx) {
        return this.loader.updateConfig('sps', 'token_records', s, trx);
    }

    async mintTokens(entries: MintConfiguration[], aid: ActionIdentifier, trx?: Trx): Promise<EventLog> {
        if (this.mint === undefined) {
            throw new AutonomousPoolError(`Trying to mint tokens while minting component wrapper is not configured correctly.`, aid, ErrorType.AutonomousMintInvalid);
        } else if (entries.length === 0) {
            throw new AutonomousPoolError(`Mint tokens while minting component wrapper is not configured correctly.`, aid, ErrorType.AutonomousMintInvalid);
        } else {
            this.mint.addEntry(aid, ...entries);
            const serialized = this.mint.serialize();
            return this.storeSerialized(serialized, trx);
        }
    }

    get tokens(): TokenSupport {
        // TODO: return base or just {}?
        return this.mint?.tokens ?? this.base;
    }
}
