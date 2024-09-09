import { array, number, object, string, boolean } from 'yup';
import { ActionIdentifier, ErrorType, ValidationError } from '../entities/errors';
import { token, TokenSupport, TokenSupportEntry, WrappedTokenSupport } from '../utilities/token_support';

export class AutonomousMintError<Value extends ErrorType> extends ValidationError<Value> {}

export type MintConfiguration = TokenSupportEntry;

const token_support_entry = object({
    token: string().strict().required(),
    precision: number().integer().min(0).optional(),
    transferable: boolean().strict().required(),
    awardable: boolean().strict().required(),
    stakes: string().strict().optional(),
    unstakes: string().strict().optional(),
    delegation: object({
        in_token: string().strict().required(),
        out_token: string().strict().required(),
    }).optional(),
});

const array_schema = array().of(token_support_entry).required();

export class AutonomousMint implements WrappedTokenSupport {
    readonly #base: TokenSupport;
    readonly #entries: Map<token, TokenSupportEntry>;

    private constructor(base: TokenSupport, entries: Map<token, TokenSupportEntry>) {
        this.#base = base;
        this.#entries = entries;
    }

    public static createWithGuardrails(base?: TokenSupport, mint_entries?: Array<MintConfiguration>) {
        return this.create(base, mint_entries);
    }

    public static create(base: TokenSupport = {}, mint_entries: unknown = []): AutonomousMint | undefined {
        if (!array_schema.isValidSync(mint_entries)) {
            return undefined;
        }

        const storedTokens = mint_entries.map((mint) => mint.token);
        const existingTokens = Object.keys(base);
        const tokens = [...storedTokens, ...existingTokens];
        const tokensSet = new Set(tokens);
        const uniqueTokens = tokens.length === tokensSet.size;

        if (!uniqueTokens) {
            // Some tokens have multiple entries
            return undefined;
        }

        const referencedTokens = new Set<string>();
        const existingTokenEntries = Object.values(base);
        for (const entry of existingTokenEntries) {
            if (entry.stakes) referencedTokens.add(entry.stakes);
            if (entry.unstakes) referencedTokens.add(entry.unstakes);
        }

        const m = new Map<token, TokenSupportEntry>();
        for (const mint of mint_entries) {
            m.set(mint.token, mint);
        }

        if (this.verifyTokensReferenced(base, m)) {
            return new AutonomousMint(base, m);
        } else {
            return undefined;
        }
    }

    private static notUndefined<T>(x: T | undefined): x is T {
        return x !== undefined;
    }

    private static verifyTokensReferenced(base: TokenSupport, storedEntries: Map<token, TokenSupportEntry>, additionalEntries: MintConfiguration[] = []): boolean {
        const entries = [...Object.values(base), ...storedEntries.values(), ...additionalEntries];

        const usedTokens = entries.flatMap((e) => [e.stakes, e.unstakes]).filter(this.notUndefined);

        const uniqueReferences = new Set([...Object.keys(base), ...storedEntries.keys(), ...additionalEntries.map((e) => e.token)]);

        return usedTokens.every((t) => uniqueReferences.has(t));
    }

    public get tokens(): TokenSupport {
        return TokenSupport.merge(this.#base, Object.fromEntries(this.#entries));
    }

    public serialize(): MintConfiguration[] {
        return [...this.#entries.values()];
    }

    private storeEntry(mintConfiguration: MintConfiguration) {
        this.#entries.set(mintConfiguration.token, mintConfiguration);
    }

    public addEntry(aid: ActionIdentifier, ...mintConfigurations: MintConfiguration[]) {
        if (mintConfigurations.length === 0) {
            return;
        }

        const unresolvedReferences = !AutonomousMint.verifyTokensReferenced(this.#base, this.#entries, mintConfigurations);
        if (unresolvedReferences) {
            throw new AutonomousMintError(`Trying to add mint entries with unresolved tokens`, aid, ErrorType.TokenReferenceNotFound);
        }

        const tokens = mintConfigurations.map((m) => m.token);
        const configurationTokensUnique = tokens.length === new Set(tokens).size;

        if (!configurationTokensUnique) {
            throw new AutonomousMintError(`Duplicate token in new mint configurations`, aid, ErrorType.AutonomousMintInvalid);
        } else if (tokens.some((token) => this.#base[token] || this.#entries.has(token))) {
            throw new AutonomousMintError(`Trying to add mint entry with token that has already been registered`, aid, ErrorType.TokenAlreadyRegistered);
        } else if (!array_schema.isValidSync(mintConfigurations)) {
            throw new AutonomousMintError(`Trying to add mint with that does not validate according to schema`, aid, ErrorType.AutonomousMintInvalid);
        }
        for (const config of mintConfigurations) {
            this.storeEntry(config);
        }
    }
}
