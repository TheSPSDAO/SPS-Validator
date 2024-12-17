/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type TokenTransferTransaction = {
    id: string;
    success: boolean;
    from: string;
    to: string;
    qty: number;
    token: string;
    memo: string;
    error?: {
        message: string;
        code: number;
    };
};

