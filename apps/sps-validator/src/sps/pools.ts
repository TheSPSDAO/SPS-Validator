import { TOKENS } from './features/tokens';

export const SpsPool = {
    name: 'staking_rewards',
    reward_account: '$SPS_STAKING_REWARDS',
    token: TOKENS.SPS,
    stake: TOKENS.SPSP,
} as const;

export const ValidatorPool = {
    name: 'validator_rewards',
    reward_account: '$REWARD_POOLS_LICENSE',
    token: TOKENS.SPS,
    stake: TOKENS.RUNNING_LICENSE,
} as const;

export const ValidatorPools = [SpsPool, ValidatorPool];
