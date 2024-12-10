/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { Balances } from '../models/Balances';
import type { PoolSettings } from '../models/PoolSettings';
import type { PriceAtPoint } from '../models/PriceAtPoint';
import type { Status } from '../models/Status';
import type { TokenTransferTransactions } from '../models/TokenTransferTransactions';
import type { Validators } from '../models/Validators';
import type { ValidatorVotes } from '../models/ValidatorVotes';
import type { CancelablePromise } from '../core/CancelablePromise';
import { request as __request } from '../core/request';

export class DefaultService {

    /**
     * Get the status of the validator node
     * @returns Status Successful operation
     * @throws ApiError
     */
    public static getStatus(): CancelablePromise<Status> {
        return __request({
            method: 'GET',
            path: `/status`,
        });
    }

    /**
     * Gets the balances of account specified in the query params
     * Returns the list of balances for the specified account name. Will return empty array if the account name was not found.
     * @param account Account name
     * @returns Balances Successful operation
     * @throws ApiError
     */
    public static getBalances(
        account: string,
    ): CancelablePromise<Balances> {
        return __request({
            method: 'GET',
            path: `/balances`,
            query: {
                'account': account,
            },
        });
    }

    /**
     * Gets the list of validators
     * @returns Validators Successful operation
     * @throws ApiError
     */
    public static getValidators(): CancelablePromise<Validators> {
        return __request({
            method: 'GET',
            path: `/validators`,
        });
    }

    /**
     * Gets the votes performed by the specified account
     * @param account Account name
     * @returns ValidatorVotes Successful operation
     * @throws ApiError
     */
    public static getVotesByAccount(
        account: string,
    ): CancelablePromise<ValidatorVotes> {
        return __request({
            method: 'GET',
            path: `/votes_by_account`,
            query: {
                'account': account,
            },
        });
    }

    /**
     * Gets the votes given to the specified validator
     * @param validator Validator
     * @returns ValidatorVotes Successful operation
     * @throws ApiError
     */
    public static getVotesByValidator(
        validator: string,
    ): CancelablePromise<ValidatorVotes> {
        return __request({
            method: 'GET',
            path: `/votes_by_validator`,
            query: {
                'validator': validator,
            },
        });
    }

    /**
     * Gets the pool parameters of a specific reward pool
     * @param poolName Name of the reward pool
     * @returns PoolSettings Correctly configured pool params
     * @throws ApiError
     */
    public static getPoolParams(
        poolName: string,
    ): CancelablePromise<PoolSettings> {
        return __request({
            method: 'GET',
            path: `/pool/${poolName}`,
            errors: {
                404: `Pool not found`,
                503: `Pool found, but currently not configured correctly`,
            },
        });
    }

    /**
     * Gets the reward debt for an account in a specific reward pool
     * @param poolName Name of the reward pool
     * @param account Account name
     * @returns number Current reward debt of account in pool
     * @throws ApiError
     */
    public static getRewardDebt(
        poolName: string,
        account: string,
    ): CancelablePromise<number> {
        return __request({
            method: 'GET',
            path: `/pool/${poolName}/reward_debt`,
            query: {
                'account': account,
            },
            errors: {
                400: `Missing account query parameter`,
                404: `Pool not found`,
            },
        });
    }

    /**
     * Gets the token transfers performed in the block
     * @param blockNum Block number
     * @returns TokenTransferTransactions Successful operation
     * @throws ApiError
     */
    public static getTokenTransferTransactions(
        blockNum: number,
    ): CancelablePromise<TokenTransferTransactions> {
        return __request({
            method: 'GET',
            path: `/transactions/${blockNum}/token_transfer`,
            errors: {
                400: `User error`,
            },
        });
    }

    /**
     * Get calculated price for a token
     * @param token Token identifier
     * @returns PriceAtPoint Successful operation
     * @throws ApiError
     */
    public static getPriceForToken(
        token: string,
    ): CancelablePromise<PriceAtPoint> {
        return __request({
            method: 'GET',
            path: `/price_feed/${token}`,
            errors: {
                404: `No price known for requested token`,
            },
        });
    }

}