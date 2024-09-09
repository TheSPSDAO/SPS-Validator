import { emoji_payload, garbage_payload } from '../../../__tests__/db-helpers';
import { Fixture as BaseFixture } from '../../../__tests__/action-fixture';
import { inject, injectable } from 'tsyringe';
import { container } from '../../../__tests__/test-composition-root';
import { BurnOpts, ClearBurnedTokensSource } from '@steem-monsters/splinterlands-validator';

@injectable()
class Fixture extends BaseFixture {
    constructor(@inject(BurnOpts) readonly burnOpts: BurnOpts, @inject(ClearBurnedTokensSource) readonly clearBurnedTokensSource: ClearBurnedTokensSource) {
        super();
    }
}

const fixture = container.resolve(Fixture);

beforeAll(async () => {
    await fixture.init();
});

beforeEach(async () => {
    await fixture.restore();
    await fixture.testHelper.insertDefaultConfiguration();
    await fixture.loader.load();
});

afterAll(async () => {
    await fixture.dispose();
});

test.dbOnly('Garbage data for burn does not crash.', () => {
    return expect(fixture.opsHelper.processVirtualOp('burn', 'steemmonsters', garbage_payload)).resolves.toBeUndefined();
});

test.dbOnly('Lots of emoji for burn does not crash.', () => {
    return expect(fixture.opsHelper.processVirtualOp('burn', 'steemmonsters', emoji_payload)).resolves.toBeUndefined();
});

test.dbOnly('Simple burning via virtual operation', async () => {
    const amount = 700;
    const { burn_account, burned_ledger_account } = fixture.burnOpts;
    await fixture.testHelper.setLiquidSPSBalance(burn_account, amount);
    const payloads = await fixture.clearBurnedTokensSource.payloads();
    expect(payloads.length).toBe(1);
    await fixture.opsHelper.processVirtualOp('burn', burn_account, payloads[0].params);
    const afterBalance = await fixture.testHelper.getDummyToken(burn_account);
    expect(afterBalance?.balance).toBe(0);
    const recorded = await fixture.testHelper.getDummyToken(burned_ledger_account);
    expect(recorded?.balance).toBe(amount);
});

test.dbOnly('Simple burning with wrong accounts is ignored', async () => {
    const amount = 300;
    const { burn_account, burned_ledger_account } = fixture.burnOpts;
    const account = `not${burn_account}`;
    await fixture.testHelper.setLiquidSPSBalance(burn_account, amount);
    const payloads = await fixture.clearBurnedTokensSource.payloads();
    expect(payloads.length).toBe(1);
    await fixture.opsHelper.processVirtualOp('burn', account, payloads[0].params);
    const afterBalance = await fixture.testHelper.getDummyToken(burn_account);
    expect(afterBalance?.balance).toBe(amount);
    const recorded = await fixture.testHelper.getDummyToken(burned_ledger_account);
    expect(recorded?.balance).toBeFalsy();
});

test.dbOnly('Without anything going on, no payloads should be generated', async () => {
    const payloads = await fixture.clearBurnedTokensSource.payloads();
    expect(payloads.length).toBe(0);
});

test.dbOnly('Multiple coin balances should imply multiple payloads', async () => {
    const { burn_account } = fixture.burnOpts;
    await fixture.testHelper.setDummyToken(burn_account, 10, 'A');
    await fixture.testHelper.setDummyToken(burn_account, 11, 'B');
    const payloads = await fixture.clearBurnedTokensSource.payloads();
    expect(payloads.length).toBe(2);
});
