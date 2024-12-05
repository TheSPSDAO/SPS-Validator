import { TokenSupport, WrappedTokenSupport } from '../../utilities/token_support';
import { Trx } from '../../db/tables';
import { HiveAccountRepository } from '../../entities/account/hive_account';
import { ErrorType, ValidationError } from '../../entities/errors';
import { Result } from '@steem-monsters/lib-monad';
import { AuthorityTypes } from '../../actions/authority';
import { ActiveDelegationsEntry, ActiveDelegationsRepository } from '../../entities/tokens/active_delegations';
import { IAction } from '../../actions/action';

export type DelegateTokensRequest = {
    from: string;
    to: string;
    qty: number;
    token: string;
    allowSystemAccounts?: boolean;
};

export type DelegateTokensMultiRequest = {
    from: string;
    to: [string, number][]; // [to, qty]
    token: string;
    allowSystemAccounts?: boolean;
};

export type UndelegateTokensRequest = {
    // could be the delegator, or when returning tokens, the delegatee
    account: string;
    to: string;
    from: string;
    qty: number;
    token: string;
    allowSystemAccounts?: boolean;
};

export type UndelegateTokensMultiRequest = {
    to: string;
    from: [string, number][]; // [from, qty]
    token: string;
    allowSystemAccounts?: boolean;
};

export type DelegationManagerOpts = {
    undelegation_cooldown_ms: number;
    system_account_whitelist?: string[];
};

export class DelegationManager {
    constructor(
        private readonly opts: DelegationManagerOpts,
        private readonly tokenSupport: WrappedTokenSupport,
        private readonly hiveAccountRepository: HiveAccountRepository,
        private readonly delegationRepository: ActiveDelegationsRepository,
    ) {}

    async validateDelegationPromise(request: Pick<DelegateTokensRequest, 'to' | 'qty' | 'token'>, action: IAction, trx?: Trx): Promise<Result<void, Error>> {
        const tokenEntry = TokenSupport.entry(this.tokenSupport.tokens, request.token);
        if (!tokenEntry || !tokenEntry.delegation) {
            return Result.Err(new ValidationError('Delegation is not supported for the specified token.', action, ErrorType.DelegationNotSupportedForToken));
        }

        // Must be valid Hive account
        const is_valid_account = await this.hiveAccountRepository.onlyHiveAccounts([request.to], trx);
        if (!is_valid_account) {
            return Result.Err(new ValidationError('Argument to and player must be a valid Hive account.', action, ErrorType.AccountNotKnown));
        }

        if (request.qty <= 0 || isNaN(request.qty)) {
            return Result.Err(new ValidationError('Amount must always be greater than 0.', action, ErrorType.AmountNotPositive));
        }

        return Result.OkVoid();
    }

    async validateDelegation(request: DelegateTokensRequest, action: IAction, trx?: Trx): Promise<Result<void, Error>> {
        const tokenEntry = TokenSupport.entry(this.tokenSupport.tokens, request.token);
        if (!tokenEntry || !tokenEntry.delegation) {
            return Result.Err(new ValidationError('Delegation is not supported for the specified token.', action, ErrorType.DelegationNotSupportedForToken));
        }
        // Check that to is not the delegator himself.
        else if (request.to === request.from) {
            return Result.Err(new ValidationError('Cannot delegate tokens to yourself.', action, ErrorType.CannotDelegateToSelf));
        }

        // Must be valid Hive account
        const accountsToValidate = [request.to, request.from];
        const is_valid_account = await (request.allowSystemAccounts
            ? this.hiveAccountRepository.onlyHiveOrSystemAccounts(accountsToValidate, trx)
            : this.validAccounts(accountsToValidate, trx));
        if (!is_valid_account) {
            return Result.Err(new ValidationError('Arguments to and from must be a valid Hive account.', action, ErrorType.AccountNotKnown));
        }

        if (request.qty <= 0 || isNaN(request.qty)) {
            return Result.Err(new ValidationError('Amount must always be greater than 0.', action, ErrorType.AmountNotPositive));
        }

        // check authority
        const has_authority = await this.hiveAccountRepository.checkAuthority(action.op.account, AuthorityTypes.DELEGATION, request.from, trx);
        if (!has_authority) {
            return Result.Err(new ValidationError(`${action.op.account} does not have the authority to delegate tokens for ${request.from}.`, action, ErrorType.NoAuthority));
        }

        // Check that the player has enough liquid tokens in their account
        const available_balance = await this.delegationRepository.getAvailableBalance(request.from, tokenEntry, trx);
        if (available_balance < request.qty) {
            return Result.Err(new ValidationError(`Insufficient liquid ${request.token}.`, action, ErrorType.InsufficientBalance));
        }

        return Result.OkVoid();
    }

    async validateDelegationMulti(request: DelegateTokensMultiRequest, action: IAction, trx?: Trx): Promise<Result<void, Error>> {
        const tokenEntry = TokenSupport.entry(this.tokenSupport.tokens, request.token);
        if (!tokenEntry || !tokenEntry.delegation) {
            return Result.Err(new ValidationError('Delegation is not supported for the specified token.', action, ErrorType.DelegationNotSupportedForToken));
        }
        // Check that to is not the delegator himself.
        else if (request.to.some(([account]) => account === request.from)) {
            return Result.Err(new ValidationError('Cannot delegate tokens to yourself.', action, ErrorType.CannotDelegateToSelf));
        }

        // Must be valid Hive account
        const toAccounts = request.to.map(([account]) => account);
        const accountsToValidate = [...toAccounts, request.from];
        const is_valid_account = await (request.allowSystemAccounts
            ? this.hiveAccountRepository.onlyHiveOrSystemAccounts(accountsToValidate, trx)
            : this.validAccounts(accountsToValidate, trx));
        if (!is_valid_account) {
            return Result.Err(new ValidationError('to players must all be valid Hive accounts.', action, ErrorType.AccountNotKnown));
        }

        if (request.to.some(([_, qty]) => qty <= 0 || isNaN(qty))) {
            return Result.Err(new ValidationError('Amount must always be greater than 0.', action, ErrorType.AmountNotPositive));
        }

        // check authority
        const has_authority = await this.hiveAccountRepository.checkAuthority(action.op.account, AuthorityTypes.DELEGATION, request.from, trx);
        if (!has_authority) {
            return Result.Err(new ValidationError(`${action.op.account} does not have the authority to delegate tokens for ${request.from}.`, action, ErrorType.NoAuthority));
        }

        const qtyNeeded = request.to.reduce((acc, [_, qty]) => acc + qty, 0);
        // Check that the player has enough liquid tokens in their account
        const available_balance = await this.delegationRepository.getAvailableBalance(request.from, tokenEntry, trx);
        if (available_balance < qtyNeeded) {
            return Result.Err(new ValidationError(`Insufficient liquid ${request.token}.`, action, ErrorType.InsufficientBalance));
        }

        return Result.OkVoid();
    }

    async delegate(delegation: DelegateTokensRequest, action: IAction, trx?: Trx) {
        const tokenEntry = TokenSupport.entry(this.tokenSupport.tokens, delegation.token);
        if (!tokenEntry || !tokenEntry.delegation) {
            // return Result.Err(new ValidationError('Delegation is not supported for the specified token.', action, ErrorType.DelegationNotSupportedForToken));
            // TODO - make return type Result? validation should always be called.
            throw new Error(`Delegation is not supported for the specified token: ${delegation.token}.`);
        }
        return this.delegationRepository.delegate(action, delegation.from, delegation.to, tokenEntry, delegation.qty, trx);
    }

    async validateUndelegation(request: UndelegateTokensRequest, action: IAction, trx?: Trx): Promise<Result<void, Error>> {
        const tokenEntry = TokenSupport.entry(this.tokenSupport.tokens, request.token);
        if (!tokenEntry || !tokenEntry.delegation) {
            return Result.Err(new ValidationError('Delegation is not supported for the specified token.', action, ErrorType.DelegationNotSupportedForToken));
        }
        // Check that to is not the delegator himself.
        else if (request.to === request.from) {
            return Result.Err(new ValidationError('Cannot undelegate tokens from yourself.', action, ErrorType.CannotUndelegateToSelf));
        }

        // Must be valid Hive account
        const accountsToValidate = [request.account, request.to, request.from];
        const is_valid_account = await (request.allowSystemAccounts
            ? this.hiveAccountRepository.onlyHiveOrSystemAccounts(accountsToValidate, trx)
            : this.validAccounts(accountsToValidate, trx));
        if (!is_valid_account) {
            return Result.Err(new ValidationError('Argument to and from must be a valid Hive account.', action, ErrorType.AccountNotKnown));
        }

        if (request.qty <= 0 || isNaN(request.qty)) {
            return Result.Err(new ValidationError('Amount must always be greater than 0.', action, ErrorType.AmountNotPositive));
        }

        // check authority against the account field. when undelegating, its just the "to" field. when returning tokens its the "from" field.
        const has_authority = await this.hiveAccountRepository.checkAuthority(action.op.account, AuthorityTypes.DELEGATION, request.account, trx);
        if (!has_authority) {
            return Result.Err(new ValidationError(`${action.op.account} does not have the authority to undelegate tokens for ${request.account}.`, action, ErrorType.NoAuthority));
        }

        // Check that the undelegation amount is not greater than amount delegated
        const active_delegation = await this.delegationRepository.getActiveDelegation(request.to, request.from, request.token, trx);
        if (!active_delegation) {
            return Result.Err(
                new ValidationError(`There is currently no ${request.token} tokens delegated from ${request.to} to ${request.from}.`, action, ErrorType.NoTokensDelegated),
            );
        }

        const validationResult = this.canUndelegate(active_delegation, request.token, request.from, request.to, request.qty, action);
        if (Result.isErr(validationResult)) {
            return validationResult;
        }

        return Result.OkVoid();
    }

    async validateUndelegationMulti(request: UndelegateTokensMultiRequest, action: IAction, trx?: Trx): Promise<Result<void, Error>> {
        const tokenEntry = TokenSupport.entry(this.tokenSupport.tokens, request.token);
        if (!tokenEntry || !tokenEntry.delegation) {
            return Result.Err(new ValidationError('Delegation is not supported for the specified token.', action, ErrorType.DelegationNotSupportedForToken));
        }
        // Must be valid Hive account
        const accounts = request.from.map(([account]) => account);
        if (accounts.some((a) => a === request.to)) {
            return Result.Err(new ValidationError('Cannot undelegate tokens from yourself.', action, ErrorType.CannotUndelegateToSelf));
        }

        const accountsToValidate = [...accounts, request.to];
        const is_valid_account = await (request.allowSystemAccounts
            ? this.hiveAccountRepository.onlyHiveOrSystemAccounts(accountsToValidate, trx)
            : this.validAccounts(accountsToValidate, trx));
        if (!is_valid_account) {
            return Result.Err(new ValidationError('Argument to must be a valid Hive account.', action, ErrorType.AccountNotKnown));
        }

        if (request.from.some(([_, qty]) => qty <= 0 || isNaN(qty))) {
            return Result.Err(new ValidationError('Amount must always be greater than 0.', action, ErrorType.AmountNotPositive));
        }

        // check authority
        const has_authority = await this.hiveAccountRepository.checkAuthority(action.op.account, AuthorityTypes.DELEGATION, request.to, trx);
        if (!has_authority) {
            return Result.Err(new ValidationError(`${action.op.account} does not have the authority to undelegate tokens for ${request.to}.`, action, ErrorType.NoAuthority));
        }

        // Check that the undelegation amount is not bigger than amount delegated
        const active_delegations = await this.delegationRepository.getActiveDelegations(request.to, accounts, request.token, trx);

        for (const [from, qty] of request.from) {
            const active_delegation = active_delegations.find((d) => d.delegatee === from);
            const validationResult = this.canUndelegate(active_delegation, request.token, from, request.to, qty, action);
            if (Result.isErr(validationResult)) {
                return validationResult;
            }
        }

        return Result.OkVoid();
    }

    private canUndelegate(delegation: ActiveDelegationsEntry | undefined, token: string, from: string, to: string, qty: number, action: IAction): Result<void, Error> {
        if (!delegation) {
            return Result.Err(new ValidationError(`There is currently no ${token} tokens delegated from ${to} to ${from}.`, action, ErrorType.NoTokensDelegated));
        } else if (qty > delegation.amount) {
            return Result.Err(new ValidationError(`Cannot undelegate more than you have delegated.`, action, ErrorType.UndelegationAmountTooHigh));
        } else if (action.op.block_time.getTime() - delegation.last_delegation_date.getTime() < this.opts.undelegation_cooldown_ms) {
            return Result.Err(
                new ValidationError(
                    `You have recently delegated from ${to} to ${from} and you must wait a while before being able to undelegate.`,
                    action,
                    ErrorType.UndelegationTooSoon,
                ),
            );
        }
        return Result.OkVoid();
    }

    async undelegate(request: UndelegateTokensRequest, action: IAction, trx?: Trx) {
        const tokenEntry = TokenSupport.entry(this.tokenSupport.tokens, request.token);
        if (!tokenEntry || !tokenEntry.delegation) {
            throw new Error(`Delegation is not supported for the specified token: ${request.token}.`);
        }
        return this.delegationRepository.undelegate(action, request.to, request.from, tokenEntry, request.qty, trx);
    }

    private async validAccounts(accounts: string[], trx?: Trx): Promise<boolean> {
        const systemAccounts = accounts.filter((a) => a.startsWith('$'));
        const hiveAccounts = accounts.filter((a) => !a.startsWith('$'));
        const is_valid_account = await this.hiveAccountRepository.onlyHiveAccounts(hiveAccounts, trx);
        const is_valid_sys_account = systemAccounts.every((account) => this.opts.system_account_whitelist?.includes(account) ?? false);
        return is_valid_account && is_valid_sys_account;
    }
}
