/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { string_ } from './string_';
export type Transaction = {
    id: string_;
    block_id: string;
    prev_block_id: string;
    block_num: number;
    type: string;
    player: string;
    data?: string;
    success?: boolean;
    error?: string;
    created_date?: string;
    result?: string;
};

