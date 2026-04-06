import { number, object } from 'yup';

// Re-export types from validator lib
export { DelegationRentalConfig, DelegationRentalWatch } from '@steem-monsters/splinterlands-validator';

export const delegation_rental_schema = object({
    qty_divisor: number().required().min(1),
    min_qty: number().required().min(0),
});
