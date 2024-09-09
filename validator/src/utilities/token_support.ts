export type token = string;
export type payout = [number, token] | 0;
type StakingData = { stakes?: token; unstakes?: token };
export type DelegationSupport = { out_token: token; in_token: token };
type DelegationData = { delegation?: DelegationSupport };
export type TokenSupportEntry = {
    // 0 -> integer. TODO: anything else -> no special treatment
    token: string;
    precision?: number;
    awardable?: boolean;
    transferable: boolean;
} & StakingData &
    DelegationData;

export type TokenSupport = Record<token, TokenSupportEntry>;

export const TokenSupport = {
    entry: (tokens: TokenSupport, token: token) => tokens[token],
    unstake: (tokens: TokenSupport, token: token) => tokens[token]?.unstakes,
    stake: (tokens: TokenSupport, token: token) => tokens[token]?.stakes,
    delegation: (tokens: TokenSupport, token: token) => tokens[token]?.delegation,
    isSupported: (tokens: TokenSupport, token: token) => !!tokens[token]?.transferable,
    isDivisible: (tokens: TokenSupport, token: token) => !(tokens[token]?.precision === 0),
    canTransfer: (tokens: TokenSupport, token: token, qty?: number) => {
        const support = TokenSupport.isSupported(tokens, token);
        if (qty === undefined) {
            return support;
        } else {
            return support && (Number.isSafeInteger(qty) || TokenSupport.isDivisible(tokens, token));
        }
    },
    wrap: (tokens: TokenSupport): WrappedTokenSupport => {
        return { tokens };
    },
    merge: (tokens: TokenSupport, ...args: TokenSupport[]): TokenSupport =>
        args.reduce(
            (prev, curr) => {
                Object.entries(curr).forEach(([key, value]) => {
                    if (!prev[key]) {
                        prev[key] = value;
                    }
                });
                return prev;
            },
            { ...tokens },
        ),
};

export interface WrappedTokenSupport {
    readonly tokens: TokenSupport;
}
export const WrappedTokenSupport: unique symbol = Symbol('WrappedTokenSupport');
