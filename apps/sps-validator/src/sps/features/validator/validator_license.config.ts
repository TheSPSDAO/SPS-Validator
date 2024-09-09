import { Watcher } from '@steem-monsters/splinterlands-validator';
import { number, object } from 'yup';

export type ValidatorCheckInConfig = {
    check_in_window_blocks: number;
    check_in_interval_blocks: number;
};

export type ValidatorCheckInWatch = Watcher<'validator_check_in', ValidatorCheckInConfig>;
export const ValidatorCheckInWatch: unique symbol = Symbol('ValidatorCheckInWatch');

export const validator_check_in_schema = object({
    check_in_window_blocks: number().required(),
    check_in_interval_blocks: number().required(),
});
