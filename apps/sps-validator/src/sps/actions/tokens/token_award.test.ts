import { emoji_payload, garbage_payload } from '../../../__tests__/db-helpers';
import { Fixture } from '../../../__tests__/action-fixture';
import { container } from '../../../__tests__/test-composition-root';
import { TOKENS } from '../../features/tokens';

const fixture = container.resolve(Fixture);

const admin_account = 'sl-admin-1';
const system_account = '$SPS_STAKING_REWARDS';

beforeAll(async () => {
    await fixture.init();
});

beforeEach(async () => {
    await fixture.restore();
    await fixture.testHelper.insertExistingAdmins(['sl-admin-1', 'sl-admin-2', 'sl-admin-3', 'sl-admin-4', 'sl-admin-5']);
    await fixture.loader.load();
});

afterAll(async () => {
    await fixture.dispose();
});

test.dbOnly('Garbage data for token_award does not crash.', () => {
    return expect(fixture.opsHelper.processOp('token_award', admin_account, garbage_payload)).resolves.toBeUndefined();
});

test.dbOnly('Lots of emoji for token_award does not crash.', () => {
    return expect(fixture.opsHelper.processOp('token_award', admin_account, emoji_payload)).resolves.toBeUndefined();
});

test.dbOnly('Simple token_award.', async () => {
    const player = 'some-player';
    const initial_system_balance = 100000;
    const initial_player_balance = 100;
    const award_qty = 100;

    await fixture.testHelper.setLiquidSPSBalance(system_account, initial_system_balance);
    await fixture.testHelper.setLiquidSPSBalance(player, initial_player_balance);

    await expect(
        fixture.opsHelper.processOp('token_award', admin_account, {
            to: player,
            from: system_account,
            token: TOKENS.SPS,
            qty: award_qty,
        }),
    ).resolves.toBeUndefined();

    const liquid_system_balance_after = (await fixture.testHelper.getDummyToken(system_account, TOKENS.SPS))?.balance;
    const liquid_player_balance_after = (await fixture.testHelper.getDummyToken(player, TOKENS.SPS))?.balance;

    expect(liquid_system_balance_after).toBe(initial_system_balance - award_qty);
    expect(liquid_player_balance_after).toBe(initial_player_balance + award_qty);
});

test.dbOnly('token_award fails if posting key is used.', async () => {
    const player = 'someplayer';
    const initial_system_balance = 100000;
    const initial_player_balance = 100;
    const award_qty = 100;

    await fixture.testHelper.setLiquidSPSBalance(system_account, initial_system_balance);
    await fixture.testHelper.setLiquidSPSBalance(player, initial_player_balance);

    await expect(
        fixture.opsHelper.processOp(
            'token_award',
            admin_account,
            {
                to: player,
                from: system_account,
                token: TOKENS.SPS,
                qty: award_qty,
            },
            { is_active: false },
        ),
    ).resolves.toBeUndefined();

    const liquid_system_balance_after = (await fixture.testHelper.getDummyToken(system_account, TOKENS.SPS))?.balance;
    const liquid_player_balance_after = (await fixture.testHelper.getDummyToken(player, TOKENS.SPS))?.balance;

    expect(liquid_system_balance_after).toBe(initial_system_balance);
    expect(liquid_player_balance_after).toBe(initial_player_balance);
});

test.dbOnly('token_award is ignored if unsupported token is awarded.', async () => {
    const dummy = 'SPSX';
    const player = 'someplayer';
    const initial_system_balance = 100000;
    const initial_player_balance = 100;
    const award_qty = 100;

    await fixture.testHelper.setDummyToken(system_account, initial_system_balance, dummy);
    await fixture.testHelper.setDummyToken(player, initial_player_balance, dummy);

    await expect(
        fixture.opsHelper.processOp('token_award', admin_account, {
            to: player,
            from: system_account,
            token: dummy,
            qty: award_qty,
        }),
    ).resolves.toBeUndefined();

    const liquid_system_balance_after = (await fixture.testHelper.getDummyToken(system_account, dummy))?.balance;
    const liquid_player_balance_after = (await fixture.testHelper.getDummyToken(player, dummy))?.balance;

    expect(liquid_system_balance_after).toBe(initial_system_balance);
    expect(liquid_player_balance_after).toBe(initial_player_balance);
});

test.dbOnly('token_award fails if signed by non-admin.', async () => {
    const player = 'someplayer';
    const not_an_admin = 'non-admin';
    const initial_system_balance = 100000;
    const initial_player_balance = 100;
    const award_qty = 100;

    await fixture.testHelper.setLiquidSPSBalance(system_account, initial_system_balance);
    await fixture.testHelper.setLiquidSPSBalance(player, initial_player_balance);

    await expect(
        fixture.opsHelper.processOp('token_award', not_an_admin, {
            to: player,
            from: system_account,
            token: TOKENS.SPS,
            qty: award_qty,
        }),
    ).resolves.toBeUndefined();

    const liquid_system_balance_after = (await fixture.testHelper.getDummyToken(system_account, TOKENS.SPS))?.balance;
    const liquid_player_balance_after = (await fixture.testHelper.getDummyToken(player, TOKENS.SPS))?.balance;

    expect(liquid_system_balance_after).toBe(initial_system_balance);
    expect(liquid_player_balance_after).toBe(initial_player_balance);
});

test.dbOnly('token_award fails if from account is not a system account.', async () => {
    const player = 'someplayer';
    const not_a_system_account = 'non_system_acc';
    const initial_notasystem_balance = 100000;
    const initial_player_balance = 100;
    const award_qty = 100;

    await fixture.testHelper.setLiquidSPSBalance(not_a_system_account, initial_notasystem_balance);
    await fixture.testHelper.setLiquidSPSBalance(player, initial_player_balance);

    await expect(
        fixture.opsHelper.processOp('token_award', admin_account, {
            to: player,
            from: admin_account,
            token: TOKENS.SPS,
            qty: award_qty,
        }),
    ).resolves.toBeUndefined();

    const liquid_notasystem_balance_after = (await fixture.testHelper.getDummyToken(not_a_system_account, TOKENS.SPS))?.balance;
    const liquid_player_balance_after = (await fixture.testHelper.getDummyToken(player, TOKENS.SPS))?.balance;

    expect(liquid_notasystem_balance_after).toBe(initial_notasystem_balance);
    expect(liquid_player_balance_after).toBe(initial_player_balance);
});

test.dbOnly('token_award negative amount fails.', async () => {
    const player = 'someplayer';
    const initial_system_balance = 100000;
    const initial_player_balance = 100;
    const award_qty = -100;

    await fixture.testHelper.setLiquidSPSBalance(system_account, initial_system_balance);
    await fixture.testHelper.setLiquidSPSBalance(player, initial_player_balance);

    await expect(
        fixture.opsHelper.processOp('token_award', admin_account, {
            to: player,
            from: system_account,
            token: TOKENS.SPS,
            qty: award_qty,
        }),
    ).resolves.toBeUndefined();

    const liquid_system_balance_after = (await fixture.testHelper.getDummyToken(system_account, TOKENS.SPS))?.balance;
    const liquid_player_balance_after = (await fixture.testHelper.getDummyToken(player, TOKENS.SPS))?.balance;

    expect(liquid_system_balance_after).toBe(initial_system_balance);
    expect(liquid_player_balance_after).toBe(initial_player_balance);
});
