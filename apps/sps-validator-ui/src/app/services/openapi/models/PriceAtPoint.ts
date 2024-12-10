/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { NoPriceAtPoint } from './NoPriceAtPoint';

export type PriceAtPoint = (NoPriceAtPoint & {
    price: number;
});
