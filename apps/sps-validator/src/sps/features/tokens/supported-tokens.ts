export const TOKENS = {
    SPS: 'SPS',
    SPSP: 'SPSP',
    SPSP_IN: 'SPSP-IN',
    SPSP_OUT: 'SPSP-OUT',
    LICENSE: 'LICENSE',
    ACTIVATED_LICENSE: 'ACTIVATED_LICENSE',
    RUNNING_LICENSE: 'RUNNING_LICENSE',
};

export const SUPPORTED_TOKENS = {
    [TOKENS.SPS]: { token: TOKENS.SPS, transferable: true, awardable: true, stakes: TOKENS.SPSP },
    [TOKENS.SPSP]: {
        token: TOKENS.SPSP,
        transferable: false,
        unstakes: TOKENS.SPS,
        delegation: { in_token: TOKENS.SPSP_IN, out_token: TOKENS.SPSP_OUT },
    },
    [TOKENS.LICENSE]: { token: TOKENS.LICENSE, transferable: true, precision: 0 },
    [TOKENS.ACTIVATED_LICENSE]: { token: TOKENS.ACTIVATED_LICENSE, transferable: false, precision: 0 },
    [TOKENS.RUNNING_LICENSE]: { token: TOKENS.RUNNING_LICENSE, transferable: false, precision: 0 },
} as const;
