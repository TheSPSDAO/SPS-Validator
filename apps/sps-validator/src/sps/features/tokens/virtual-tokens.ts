import { TOKENS } from './supported-tokens';

export const VIRTUAL_TOKENS = {
    SPS_TOTAL: 'SPS_TOTAL',
    LICENSE_TOTAL: 'LICENSE_TOTAL',
};

export const VIRTUAL_TOKENS_CONFIG = {
    [VIRTUAL_TOKENS.SPS_TOTAL]: [TOKENS.SPS, TOKENS.SPSP],
    [VIRTUAL_TOKENS.LICENSE_TOTAL]: [TOKENS.LICENSE, TOKENS.ACTIVATED_LICENSE],
} as const;

export type VirtualTokenConfig = Record<string, string[]>;
export const VirtualTokenConfig = Symbol('VirtualTokenConfig');
