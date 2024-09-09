import { systemAccount } from '../actions/schema';
import { InferType, object } from 'yup';

export type StakingConfiguration = {
    staking_account: string; // System account
    staking_rewards_account: string; // System account
};

export const StakingConfiguration: unique symbol = Symbol('StakingConfiguration');

const staking_configuration_schema = object({
    staking_account: systemAccount.required(),
    staking_rewards_account: systemAccount.required(),
});

type type_check<T, _W extends T> = never;
type _staking_configuration_check = type_check<StakingConfiguration, InferType<typeof staking_configuration_schema>>;

export const StakingConfigurationHelpers = {
    validate: (stakingConfiguration: StakingConfiguration) => staking_configuration_schema.isValidSync(stakingConfiguration),
};
