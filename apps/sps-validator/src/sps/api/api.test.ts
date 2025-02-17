import supertest from 'supertest';
import type { SuperTest, Test } from 'supertest';
import { SpsConfigLoader } from '../config';
import express from 'express';
import { Fixture as BaseFixture } from '../../__tests__/fixture';
import { inject, injectable } from 'tsyringe';
import { container } from '../../__tests__/test-composition-root';
import { ConfigType } from '../convict-config';
import { BlockEntity, ConfigEntity, LastBlockCache, Middleware, registerApiRoutes, StakingPoolRewardDebtEntity } from '@steem-monsters/splinterlands-validator';
import { registerSpsRoutes } from './sps';

@injectable()
class Fixture extends BaseFixture {
    readonly request: SuperTest<Test>;
    constructor(
        @inject(ConfigType) cfg: ConfigType,
        @inject(SpsConfigLoader) readonly loader: SpsConfigLoader,
        @inject(LastBlockCache) readonly lastBlockCache: LastBlockCache,
        @inject(Middleware) middleware: Middleware,
    ) {
        super();
        const app = express();
        registerApiRoutes(app, {
            resolver: container,
            health_checker: cfg.health_checker,
            injection_middleware: middleware,
        });
        registerSpsRoutes(app);
        this.request = supertest(app);
    }
}
const fixture = container.resolve(Fixture);

beforeAll(async () => {
    await fixture.init();
});

beforeEach(async () => {
    await fixture.restore();
    await fixture.handle.query(BlockEntity).insertItem({ block_num: 0, block_time: new Date(), block_id: '', prev_block_id: '', l2_block_id: '' });
    await fixture.loader.load();
});

afterAll(async () => {
    await fixture.dispose();
});

describe('Price feed API endpoint', () => {
    beforeEach(async () => {
        await fixture.testHelper.insertDefaultConfiguration();
        await fixture.handle.query(ConfigEntity).where('group_name', 'validator').andWhere('name', 'num_top_validators').updateItem({
            value: '3',
        });
        await fixture.testHelper.insertDummyValidator('someadmin1', true, 10);
        await fixture.testHelper.insertDummyValidator('someadmin2', true, 8);
        await fixture.testHelper.insertDummyValidator('someadmin3', true, 6);
        await fixture.loader.load();
    });

    test.dbOnly.each`
        token        | status | price
        ${'SPS'}     | ${404} | ${undefined}
        ${'DEC'}     | ${404} | ${undefined}
        ${'not-SPS'} | ${404} | ${undefined}
    `(`Checking [$token] without prices should give HTTP status [$status] with price [$price]`, async ({ token, status, price }) => {
        const response = await fixture.request.get(`/price_feed/${token}`);
        expect(response.status).toBe(status);
        expect(response.body.token).toBe(token);
        expect(response.body.price).toBe(price);
    });

    test.dbOnly.each`
        token        | status | price
        ${'SPS'}     | ${200} | ${7331.2}
        ${'DEC'}     | ${404} | ${undefined}
        ${'not-SPS'} | ${404} | ${undefined}
    `(`Checking [$token] after one price point for SPS should give HTTP status [$status] with price [$price]`, async ({ token, status, price }) => {
        await fixture.opsHelper.processOp(
            'price_feed',
            'someadmin1',
            {
                updates: [{ token: 'SPS', price: 7331.2 }],
            },
            { block_num: fixture.loader.validator!.reward_start_block + 1 },
        );
        const response = await fixture.request.get(`/price_feed/${token}`);
        expect(response.status).toBe(status);
        expect(response.body.token).toBe(token);
        expect(response.body.price).toBe(price);
    });

    test.dbOnly.each`
        token        | status | price
        ${'SPS'}     | ${200} | ${300}
        ${'DEC'}     | ${404} | ${undefined}
        ${'not-SPS'} | ${404} | ${undefined}
    `(`Checking [$token] after several price points should give HTTP status [$status] with price [$price]`, async ({ token, status, price }) => {
        await fixture.opsHelper.processOp(
            'price_feed',
            'someadmin1',
            {
                updates: [{ token: 'SPS', price: 100 }],
            },
            { block_num: fixture.loader.validator!.reward_start_block + 1 },
        );
        await fixture.opsHelper.processOp(
            'price_feed',
            'someadmin2',
            {
                updates: [{ token: 'SPS', price: 500 }],
            },
            { block_num: fixture.loader.validator!.reward_start_block + 1 },
        );
        await fixture.opsHelper.processOp(
            'price_feed',
            'someadmin3',
            {
                updates: [{ token: 'SPS', price: 300 }],
            },
            { block_num: fixture.loader.validator!.reward_start_block + 1 },
        );
        const response = await fixture.request.get(`/price_feed/${token}`);
        expect(response.status).toBe(status);
        expect(response.body.token).toBe(token);
        expect(response.body.price).toBe(price);
    });

    test.dbOnly('Checking nonsense token for specific last block date.', async () => {
        const random_date = '1992-06-30T12:11:22.600Z';
        fixture.lastBlockCache.update({ block_num: 7331, block_id: 'some-random-id', block_time: new Date(random_date) });
        const response = await fixture.request.get(`/price_feed/not-SPS`);
        expect(response.body.date).toBe(random_date);
    });
});

describe('Pool settings endpoints', () => {
    const staking_rewards_settings = {
        acc_tokens_per_share: 1,
        last_reward_block: 56186000,
        start_block: 56186000,
        tokens_per_block: 8.56164,
        reduction_blocks: 864000,
        reduction_pct: 1,
        total_staked: {
            amount: 0,
            token: 'SPSP',
        },
    };
    const validator_rewards_settings = {
        acc_tokens_per_share: 1,
        last_reward_block: 56186000,
        start_block: 56186000,
        tokens_per_block: 8.56164,
        reduction_blocks: 864000,
        reduction_pct: 1,
        total_staked: {
            amount: 0,
            token: 'RUNNING_LICENSE',
        },
    };
    beforeEach(async () => {
        await fixture.handle.query(ConfigEntity).insertItem({
            group_name: 'sps',
            group_type: 'object',
            name: 'staking_rewards',
            index: 0,
            value_type: 'object',
            value: JSON.stringify({
                tokens_per_block: staking_rewards_settings.tokens_per_block,
                reduction_blocks: 864000,
                reduction_pct: 1,
                start_block: staking_rewards_settings.start_block,
            }),
        });
        await fixture.handle.query(ConfigEntity).insertItem({
            group_name: 'sps',
            group_type: 'object',
            name: 'staking_rewards_last_reward_block',
            index: 0,
            value_type: 'number',
            value: JSON.stringify(staking_rewards_settings.last_reward_block),
        });
        await fixture.handle.query(ConfigEntity).insertItem({
            group_name: 'sps',
            group_type: 'object',
            name: 'staking_rewards_acc_tokens_per_share',
            index: 0,
            value_type: 'number',
            value: JSON.stringify(staking_rewards_settings.acc_tokens_per_share),
        });
        await fixture.handle.query(StakingPoolRewardDebtEntity).insertItem({
            player: 'rewardinguser',
            pool_name: 'staking_rewards',
            reward_debt: '300',
        });
        await fixture.handle.query(ConfigEntity).insertItem({
            group_name: 'sps',
            group_type: 'object',
            name: 'validator_rewards',
            index: 0,
            value_type: 'object',
            value: JSON.stringify({
                tokens_per_block: validator_rewards_settings.tokens_per_block,
                reduction_blocks: 864000,
                reduction_pct: 1,
                start_block: validator_rewards_settings.start_block,
            }),
        });
        await fixture.handle.query(ConfigEntity).insertItem({
            group_name: 'sps',
            group_type: 'object',
            name: 'validator_rewards_last_reward_block',
            index: 0,
            value_type: 'number',
            value: JSON.stringify(validator_rewards_settings.last_reward_block),
        });
        await fixture.handle.query(ConfigEntity).insertItem({
            group_name: 'sps',
            group_type: 'object',
            name: 'validator_rewards_acc_tokens_per_share',
            index: 0,
            value_type: 'number',
            value: JSON.stringify(validator_rewards_settings.acc_tokens_per_share),
        });
        await fixture.loader.load();
    });

    test.dbOnly.each`
        pool                         | status | settings
        ${'staking_rewards'}         | ${200} | ${staking_rewards_settings}
        ${'validator_rewards'}       | ${200} | ${validator_rewards_settings}
        ${'not-staking_rewards'}     | ${404} | ${{}}
    `(`Checking settings for [$pool] should give HTTP status [$status] and settings [$settings]`, async ({ pool, status, settings }) => {
        const response = await fixture.request.get(`/pool/${pool}`);
        expect(response.status).toBe(status);
        expect(response.body).toStrictEqual(settings);
    });

    test.dbOnly.each`
        pool                         | query                           | status | debt
        ${'staking_rewards'}         | ${{ account: 'rewardinguser' }} | ${200} | ${300}
        ${'staking_rewards'}         | ${''}                           | ${400} | ${{}}
        ${'not-staking_rewards'}     | ${{ account: 'rewardinguser' }} | ${404} | ${{}}
    `(`Checking debt in [$pool] with query [$query] should give [$debt] with HTTP status [$status]`, async ({ pool, query, status, debt }) => {
        const response = await fixture.request.get(`/pool/${pool}/reward_debt`).query(query);
        expect(response.status).toBe(status);
        expect(response.body).toStrictEqual(debt);
    });
});

describe('Balance API endpoint', () => {
    beforeEach(async () => {
        await Promise.all([
            fixture.testHelper.setLiquidSPSBalance('richuser', 7331),
            fixture.testHelper.setDummyToken('richuser', 1, 'DEC'),
            fixture.testHelper.setLiquidSPSBalance('pooruser', 1),
            fixture.testHelper.setDummyToken('pooruser', 3, 'DEC'),
        ]);
        await fixture.loader.load();
    });

    test.dbOnly.each`
        query                      | status | token    | balance | hasBalance
        ${{ account: 'richuser' }} | ${200} | ${'SPS'} | ${7331} | ${true}
        ${{ account: 'richuser' }} | ${200} | ${'SPS'} | ${7334} | ${false}
        ${{ account: 'richuser' }} | ${200} | ${'DEC'} | ${1}    | ${true}
        ${{ account: 'richuser' }} | ${200} | ${'DEC'} | ${9}    | ${false}
        ${{ account: 'pooruser' }} | ${200} | ${'SPS'} | ${1}    | ${true}
        ${{ account: 'pooruser' }} | ${200} | ${'DEC'} | ${3}    | ${true}
        ${''}                      | ${400} | ${'SPS'} | ${0}    | ${false}
        ${''}                      | ${400} | ${'DEC'} | ${0}    | ${false}
    `(`Checking balance for [$query] for [$token] should give [$balance] = [$hasBalance] with HTTP status [$status]`, async ({ query, status, token, balance, hasBalance }) => {
        const response = await fixture.request.get(`/balances`).query(query);
        expect(response.status).toBe(status);
        if (hasBalance) {
            expect(response.body).toEqual(expect.arrayContaining([expect.objectContaining({ token, balance })]));
        } else {
            expect(response.body).not.toEqual(expect.arrayContaining([expect.objectContaining({ token, balance })]));
        }
    });
});

describe('Transactions Api', () => {
    beforeEach(async () => {
        await fixture.testHelper.insertBlocksAndTransaction();
        fixture.lastBlockCache.update({ block_num: 2, block_id: 'some-random-id', block_time: new Date() });
    });
    test.dbOnly.each`
        block_num | status | transaction_type    | ids
        ${0}      | ${200} | ${''}               | ${[]}
        ${1}      | ${200} | ${''}               | ${[{ id: 'A' }, { id: 'D' }]}
        ${2}      | ${200} | ${''}               | ${[{ id: 'B' }]}
        ${3}      | ${404} | ${''}               | ${[]}
        ${0}      | ${200} | ${'token_transfer'} | ${[]}
        ${1}      | ${200} | ${'token_transfer'} | ${[{ id: 'A' }]}
        ${2}      | ${200} | ${'token_transfer'} | ${[{ id: 'B' }]}
        ${3}      | ${404} | ${'token_transfer'} | ${[]}
    `(`Checking [$block_num] for transactions of type [$transaction_type] with status [$status] and ids [$ids]`, async ({ block_num, status, transaction_type, ids }) => {
        const response = await fixture.request.get(`/transactions/${block_num}/${transaction_type}`);
        expect(response.status).toBe(status);
        if (status === 200) {
            expect(response.body!.length).toBe(ids.length);
        }
        for (const id of ids) {
            expect(response.body).toEqual(expect.arrayContaining([expect.objectContaining(id)]));
        }
    });
});

describe('Shop API', () => {
    beforeEach(async () => {
        await fixture.testHelper.insertBlocksAndTransaction();
        fixture.lastBlockCache.update({ block_num: 2, block_id: 'some-random-id', block_time: new Date() });
    });
    test.dbOnly.each`
        status | saleName                    | shopToken        | shopBalance  | remaining
        ${404} | ${'random_sale'}            | ${undefined}     | ${undefined} | ${undefined}
        ${200} | ${'validator_tranche_info'} | ${'LICENSE'}     | ${0}         | ${0}
        ${200} | ${'validator_tranche_info'} | ${undefined}     | ${undefined} | ${0}
        ${200} | ${'validator_tranche_info'} | ${'LICENSE'}     | ${100}       | ${100}
        ${200} | ${'validator_tranche_info'} | ${'LICENSE'}     | ${100000}    | ${100000 - 58000}
        ${200} | ${'validator_tranche_info'} | ${'LICENSE'}     | ${50001}     | ${1}
        ${200} | ${'validator_tranche_info'} | ${'LICENSE'}     | ${50000}     | ${10000}
    `(
        `Checking shop for sale [$saleName], balance of [$shopToken] times [$shopBalance] with status [$status] and remaining [$remaining]`,
        async ({ status, saleName, shopToken, shopBalance, remaining }) => {
            if (shopToken && shopBalance !== undefined) {
                await fixture.testHelper.setDummyToken('$SHOP', shopBalance, shopToken);
            }
            const response = await fixture.request.get(`/shop/${saleName}`);
            expect(response.status).toBe(status);
            expect(response.body?.remaining).toBe(remaining);
        },
    );
});

describe('Token API endpoints', () => {
    beforeEach(async () => {
        await Promise.all([
            fixture.testHelper.setMintedBalance('$MINTER', -200),
            fixture.testHelper.setDummyToken('alluser', 7, 'SPS'),
            fixture.testHelper.setDummyToken('alluser', 7, 'DEC'),
            fixture.testHelper.setDummyToken('alluser', 7, 'OTH'),
            fixture.testHelper.setDummyToken('decuser', 7, 'DEC'),
            fixture.testHelper.setDummyToken('othuser', 7, 'OTH'),
        ]);
        await fixture.loader.load();
    });

    test.dbOnly.each`
        query                        | status | token    | users                     | haveBalance
        ${{ token: 'SPS' }}          | ${200} | ${'SPS'} | ${['alluser']}            | ${true}
        ${{ token: 'DEC' }}          | ${200} | ${'DEC'} | ${['alluser', 'decuser']} | ${true}
        ${{ token: 'DEC' }}          | ${200} | ${'DEC'} | ${['alluser', 'othuser']} | ${false}
        ${{ token: 'SPS' }}          | ${200} | ${'SPS'} | ${['alluser']}            | ${true}
        ${{ token: 'SPSP' }}         | ${200} | ${'SPS'} | ${['alluser']}            | ${false}
        ${{ token: ['SPS', 'SPSP'] }}| ${200} | ${'SPS'} | ${['alluser']}            | ${true}
        ${''}                        | ${400} | ${'SPS'} | ${undefined}              | ${undefined}
    `(`Checking tokens for [$query] for [$token] should give [$users] = [$haveBalance] with HTTP status [$status]`, async ({ query, status, token, users, haveBalance }) => {
        const response = await fixture.request.get(`/tokens`).query(query);
        expect(response.status).toBe(status);
        if (response.ok) {
            const bodyUsersWithToken = response.body.balances?.map((e: any) => {
                return { player: e.player, token: e.token };
            });
            const usersWithToken = users.map((u: string) => {
                return { player: u, token };
            });
            if (haveBalance) {
                expect(bodyUsersWithToken).toEqual(expect.arrayContaining(usersWithToken));
            } else {
                expect(bodyUsersWithToken).not.toEqual(expect.arrayContaining(usersWithToken));
            }
        }
    });

    test.dbOnly.each`
        param             | status |  users
        ${'SPS'}          | ${200} |  ${['alluser', '$MINTER']}
        ${'DEC'}          | ${200} |  ${['alluser', 'decuser']}
        ${'OTH'}          | ${200} |  ${['alluser', 'othuser']}
        ${'SPSP'}         | ${200} |  ${[]}
    `(`Checking tokens for [$param] should have [$users] listed with HTTP status [$status]`, async ({ param, status, users }) => {
        const response = await fixture.request.get(`/tokens/${param}`).query({ systemAccounts: 'true' });
        expect(response.status).toBe(status);
        const bodyUsers = response.body?.balances.map((e: any) => e.player);
        expect(bodyUsers).toEqual(expect.arrayContaining(users));
    });

    test.dbOnly.each`
        param             | status | total
        ${'SPS'}          | ${200} | ${7}
        ${'DEC'}          | ${200} | ${14}
        ${'OTH'}          | ${200} | ${14}
        ${'NONE'}         | ${200} | ${0}
    `(`Checking supply for token [$param] = [$total] with HTTP status [$status]`, async ({ param, status, total }) => {
        const response = await fixture.request.get(`/tokens/${param}/supply`);
        expect(response.status).toBe(status);
        expect(response.body.circulating_supply).toBe(total);
    });
});
