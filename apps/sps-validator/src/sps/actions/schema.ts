import { Schema, Trx } from '@steem-monsters/splinterlands-validator';
import { BaseSchema, array, boolean, date, mixed, number, object, string } from 'yup';
import { AnyObject } from 'yup/lib/types';

const token_award = new Schema.Schema(
    'token_award',
    object({
        to: Schema.hiveUsernameOrSystemAccount.required(),
        from: Schema.hiveUsernameOrSystemAccount.required(),
        token: Schema.token,
        qty: Schema.qty.positive(),
    }),
);

const token_transfer = new Schema.Schema(
    'token_transfer',
    object({
        to: Schema.hiveUsernameOrSystemAccount.required(),
        token: Schema.token,
        qty: Schema.qty.positive(),
    }),
);

const burn = new Schema.Schema(
    'burn',
    object({
        account: Schema.hiveUsernameOrSystemAccount.required(),
        to: Schema.systemAccount.required(),
        token: Schema.token,
        qty: Schema.qty.positive(),
    }),
);

const token_transfer_multi = new Schema.Schema(
    'token_transfer_multi',
    object({
        type: string().strict().optional(),
        multi: array(
            object({
                token: Schema.token,
                to: array(
                    object({
                        name: Schema.hiveUsernameOrSystemAccount.required(),
                        qty: Schema.qty.positive(),
                        memo: string().strict().optional(),
                        type: string().strict().optional(),
                    }),
                ).required(),
            }),
        ).required(),
    }),
);

const delegate_tokens = new Schema.Schema(
    'delegate_tokens',
    object({
        token: Schema.token,
        to: Schema.hiveUsernameOrSystemAccount.required(),
        qty: Schema.qty.positive(),
        player: Schema.hiveAccount.optional(),
    }),
);

const undelegate_tokens = new Schema.Schema(
    'undelegate_tokens',
    object({
        token: Schema.token,
        from: Schema.hiveUsernameOrSystemAccount.required(),
        qty: Schema.qty.positive(),
        player: Schema.hiveAccount.optional(),
    }),
);

const return_tokens = new Schema.Schema(
    'return_tokens',
    object({
        token: Schema.token,
        from: Schema.hiveUsernameOrSystemAccount.required(),
        qty: Schema.qty.positive(),
        player: Schema.hiveAccount.optional(),
    }),
);

const undelegate_tokens_multi = new Schema.Schema(
    'undelegate_tokens_multi',
    object({
        token: Schema.token,
        data: array(object({ from: Schema.hiveUsernameOrSystemAccount.required(), qty: Schema.qty.positive() }))
            .required()
            .min(1),
        player: Schema.hiveAccount.optional(),
    }),
);

const stake_tokens = new Schema.Schema(
    'stake_tokens',
    object({
        token: Schema.token,
        to_player: Schema.hiveUsernameOrSystemAccount,
        from_player: Schema.systemAccount.optional(),
        qty: Schema.qty.positive(),
    }),
);

const stake_tokens_multi = new Schema.Schema(
    'stake_tokens_multi',
    object({
        token: Schema.token,
        to_player: Schema.hiveUsernameOrSystemAccount,
        multi: array(
            object({
                from: Schema.systemAccount.required(),
                qty: Schema.qty.positive(),
            }),
        )
            .min(1)
            .required(),
    }),
);

const unstake_tokens = new Schema.Schema(
    'unstake_tokens',
    object({
        token: Schema.token,
        qty: Schema.qty.positive(),
    }),
);

const cancel_unstake_tokens = new Schema.Schema(
    'cancel_unstake_tokens',
    object({
        token: Schema.token,
    }),
);

const claim_staking_rewards = new Schema.Schema('claim_staking_rewards', object({}));

const update_validator = new Schema.Schema(
    'update_validator',
    object({
        is_active: boolean().strict().required(),
        post_url: string().strict(),
        reward_account: Schema.hiveAccount.optional().nullable(),
    }),
);

// TODO: technically allows any function to be passed.
const updateFn: BaseSchema<any, AnyObject, (trx?: Trx) => void> = mixed()
    .required()
    .test('function', 'The following input is not a function', (f) => typeof f === 'function');

const token_unstaking = new Schema.Schema(
    'token_unstaking',
    object({
        player: Schema.hiveUsernameOrSystemAccount.required(),
        unstake_amount: Schema.qty.positive(),
        token: Schema.token,
        update: updateFn,
    }),
);

const approve_validator = new Schema.Schema(
    'approve_validator',
    object({
        account_name: Schema.hiveUsernameOrSystemAccount.required(),
    }),
);

const unapprove_validator = new Schema.Schema(
    'unapprove_validator',
    object({
        account_name: Schema.hiveUsernameOrSystemAccount.required(),
    }),
);

const validate_block = new Schema.Schema(
    'validate_block',
    object({
        block_num: number().integer().required(),
        hash: string().strict().required(),
    }),
);

const config_update = new Schema.Schema(
    'config_update',
    object({
        updates: array()
            .of(
                object({
                    group_name: string().strict().required(),
                    name: string().strict().required(),
                    value: string().strict().required(),
                }).unknown(true),
            )
            .required(),
    }),
);

const price_feed = new Schema.Schema(
    'price_feed',
    object({
        updates: array()
            .of(
                object({
                    token: Schema.token,
                    price: Schema.qty.positive().required(),
                }),
            )
            .required(),
        metadata: object().unknown(true).optional(),
    }),
);

const shop_purchase = new Schema.Schema(
    'shop_purchase',
    object({
        id: string().strict().required(),
        qty: Schema.qty.positive().required(),
        discount_token: object({
            token: Schema.token,
            qty: Schema.qty.integer().positive().required(),
        })
            .optional()
            .default(undefined),
        bonus_token: object({
            token: Schema.token,
            qty: Schema.qty.integer().positive().required(),
        })
            .optional()
            .default(undefined),
        hash: string().strict().optional(),
    }),
);

const update_pool = new Schema.Schema(
    'update_pool',
    object({
        name: string().strict().required(),
        token: string().strict().optional(),
        beneficiary: string().strict().optional(),
        tokensPerNormalizedDay: Schema.qty.min(0).optional(),
        start: date().optional(),
        lastPayout: date().optional(),
    }),
);

const disable_pool = new Schema.Schema(
    'disable_pool',
    object({
        name: string().strict().required(),
    }),
);

const add_pool = new Schema.Schema(
    'add_pool',
    object({
        name: string().strict().required(),
        token: string().strict().required(),
        beneficiary: string().strict().required(),
        tokensPerNormalizedDay: Schema.qty.min(0).required(),
        start: date().required(),
        lastPayout: date().optional(),
    }),
);

const claim_pool = new Schema.Schema(
    'claim_pool',
    object({
        now: date().required(),
    }),
);

const mint_tokens = new Schema.Schema(
    'mint_tokens',
    object({
        mint: array(
            object({
                entry: object({
                    token: Schema.token,
                    transferable: boolean().strict().required(),
                    precision: number().integer().min(0).optional(),
                    awardable: boolean().strict().optional(),
                    stakes: string().strict().optional(),
                    unstakes: string().strict().optional(),
                    delegation: object({
                        in_token: string().strict().required(),
                        out_token: string().strict().required(),
                    }).optional(),
                }).required(),
                payout: object({
                    beneficiary: Schema.hiveUsernameOrSystemAccount.required(),
                    qty: Schema.qty.positive().required(),
                })
                    .optional()
                    .default(undefined),
            }),
        ).required(),
    }),
);

const set_authority = new Schema.Schema(
    'set_authority',
    object({
        delegation: array(Schema.hiveAccount.required()).required(),
    }).unknown(true), // allow unknown keys because there is overlap with SM's set_authority
);

const claim_rewards = new Schema.Schema('claim_rewards', object({}));

const increment_reward_pools = new Schema.Schema(
    'increment_reward_pools',
    object({
        now: date().required(),
    }),
);

const create_promise = new Schema.Schema(
    'create_promise',
    object({
        controllers: array(string().strict().required()).min(1).required(),
        type: string().strict().required(),
        id: string().strict().required(),
        fulfill_timeout_seconds: number().strict().required(),
        params: object().unknown(true).optional(),
    }),
);

const cancel_promise = new Schema.Schema(
    'cancel_promise',
    object({
        type: string().strict().required(),
        id: string().strict().required(),
    }),
);

const reverse_promise = new Schema.Schema(
    'reverse_promise',
    object({
        type: string().strict().required(),
        id: string().strict().required(),
    }),
);

const complete_promise = new Schema.Schema(
    'complete_promise',
    object({
        type: string().strict().required(),
        id: string().strict().required(),
    }),
);

const fulfill_promise = new Schema.Schema(
    'fulfill_promise',
    object({
        type: string().strict().required(),
        id: string().strict().required(),
        metadata: object().unknown(true).optional(),
    }),
);

const fulfill_promise_multi = new Schema.Schema(
    'fulfill_promise_multi',
    object({
        type: string().strict().required(),
        ids: array(string().strict().required()).min(1).required(),
        metadata: object().unknown(true).optional(),
    }),
);

const expire_promises = new Schema.Schema(
    'expire_promises',
    object({
        now: date().required(),
    }),
);

const activate_license = new Schema.Schema(
    'activate_license',
    object({
        qty: number().integer().positive().min(1).strict().required(),
    }),
);

const deactivate_license = new Schema.Schema(
    'deactivate_license',
    object({
        qty: number().integer().positive().min(1).strict().required(),
    }),
);

const check_in_validator = new Schema.Schema(
    'check_in_validator',
    object({
        block_num: number().integer().positive().required(),
        hash: string().strict().required(),
    }),
);

const expire_check_ins = new Schema.Schema('expire_check_ins', object({}));

const update_missed_blocks = new Schema.Schema(
    'update_missed_blocks',
    object({
        account: Schema.hiveAccount.required(),
        checked_block: number().integer().positive().required(),
        missed_blocks: number().integer().positive().required(),
    }),
);

export {
    token_award,
    token_transfer,
    burn,
    token_transfer_multi,
    delegate_tokens,
    undelegate_tokens,
    undelegate_tokens_multi,
    stake_tokens,
    stake_tokens_multi,
    unstake_tokens,
    cancel_unstake_tokens,
    claim_staking_rewards,
    update_validator,
    token_unstaking,
    approve_validator,
    unapprove_validator,
    validate_block,
    config_update,
    price_feed,
    shop_purchase,
    update_pool,
    disable_pool,
    add_pool,
    claim_pool,
    mint_tokens,
    set_authority,
    claim_rewards,
    increment_reward_pools,
    create_promise,
    cancel_promise,
    reverse_promise,
    complete_promise,
    fulfill_promise,
    fulfill_promise_multi,
    expire_promises,
    activate_license,
    deactivate_license,
    check_in_validator,
    expire_check_ins,
    return_tokens,
    update_missed_blocks,
};
