import { TOKENS } from './features/tokens';

const SpsPool = {
    name: 'staking_rewards',
    reward_account: '$SPS_STAKING_REWARDS',
    token: TOKENS.SPS,
    stake: TOKENS.SPSP,
} as const;

const ValidatorPool = {
    name: 'validator_rewards',
    reward_account: '$REWARD_POOLS_LICENSE',
    token: TOKENS.SPS,
    stake: TOKENS.RUNNING_LICENSE,
} as const;

export const ValidatorPools = [SpsPool, ValidatorPool];
