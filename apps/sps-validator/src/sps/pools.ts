import { TOKENS } from './features/tokens';

const SpsPool = {
    name: 'staking_rewards',
    token: TOKENS.SPS,
    stake: TOKENS.SPSP,
} as const;

const ValidatorPool = {
    name: 'validator_rewards',
    token: TOKENS.SPS,
    stake: TOKENS.RUNNING_LICENSE,
} as const;

export const ValidatorPools = [SpsPool, ValidatorPool];
