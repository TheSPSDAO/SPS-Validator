import { object, string } from 'yup';
import { Fixture } from '../../__tests__/action-fixture';
import { container } from '../../__tests__/test-composition-root';
import {
    Action,
    ActionFactory,
    ActionRouter,
    Compute,
    ConfigEntity,
    IAction,
    OperationData,
    Schema,
    BlockRangeOpts,
    BlockRangeConfig,
    Trx,
    Route,
    LookupWrapper,
    coerceToBlockNum,
    MultiActionRouter,
} from '@steem-monsters/splinterlands-validator';

const fixture = container.resolve(Fixture);

beforeAll(async () => {
    await fixture.init();
});

beforeEach(async () => {
    await fixture.restore();

    await fixture.testHelper.insertDefaultConfiguration();
    await fixture.handle.query(ConfigEntity).where('group_name', 'validator').andWhere('name', 'reward_start_block').updateItem({
        value: '203',
    });
    await fixture.loader.load();
});

afterAll(async () => {
    await fixture.dispose();
});

afterEach(() => {
    fixture.loader.removeValidatorWatcher('my-test-watch');
    fixture.loader.clear();
});

const dummy_schema = new Schema.Schema(
    'dummy_action',
    object({
        value: string().required(),
    }),
);

class DummyAction extends Action<typeof dummy_schema.actionSchema> {
    constructor(op: OperationData, data: unknown, index?: number) {
        super(dummy_schema, op, data, index);
    }

    async validate(_trx?: Trx) {
        return true;
    }

    async process(_trx?: Trx) {
        return [];
    }
}

class Builder implements ActionFactory<DummyAction> {
    build(op: OperationData, data: unknown, index?: number) {
        return new DummyAction(op, data, index);
    }
}

class Router extends ActionRouter<IAction> {
    constructor(blockRange?: BlockRangeOpts<Compute>, readonly builder = new Builder()) {
        super();
        const route = new Route(dummy_schema.action_name, builder, new BlockRangeConfig(blockRange));
        this.addRoute(route);
    }
}

const ActiveConstantDummyConstructor = new Router({ from_block: 100 });
test.dbOnly('ConstantDummy', async () => {
    LookupWrapper.computeAndWatch(ActiveConstantDummyConstructor, fixture.loader, 'my-test-watch');
    const before = ActiveConstantDummyConstructor.route(10, dummy_schema.action_name);
    const after = ActiveConstantDummyConstructor.route(101, dummy_schema.action_name);
    expect(before).toBeNull();
    expect(after).toBe(ActiveConstantDummyConstructor.builder);
});

const ActiveFakeFlexibleDummyConstructor = new Router({ from_block: (_c) => 150 });
test.dbOnly('FakeFlexDummy', async () => {
    LookupWrapper.computeAndWatch(ActiveFakeFlexibleDummyConstructor, fixture.loader, 'my-test-watch');
    const before = ActiveFakeFlexibleDummyConstructor.route(20, dummy_schema.action_name);
    const after = ActiveFakeFlexibleDummyConstructor.route(150, dummy_schema.action_name);
    expect(before).toBeNull();
    expect(after).toBe(ActiveFakeFlexibleDummyConstructor.builder);
});

const ActiveFlexibleDummyConstructor = new Router({ from_block: (c) => coerceToBlockNum(c?.reward_start_block) ?? Number.MAX_SAFE_INTEGER });
test.dbOnly('FlexDummy', async () => {
    LookupWrapper.computeAndWatch(ActiveFlexibleDummyConstructor, fixture.loader, 'my-test-watch');
    const before = ActiveFlexibleDummyConstructor.route(100, dummy_schema.action_name);
    await fixture.opsHelper.processOp('config_update', 'steemmonsters', {
        updates: [{ group_name: 'validator', name: 'reward_start_block', value: JSON.stringify(80) }],
    });
    const after = ActiveFlexibleDummyConstructor.route(100, dummy_schema.action_name);
    expect(before).toBeNull();
    expect(after).toBe(ActiveFlexibleDummyConstructor.builder);
});

test.dbOnly('InverseRealFlexDummy', async () => {
    LookupWrapper.computeAndWatch(ActiveFlexibleDummyConstructor, fixture.loader, 'my-test-watch');
    const before = ActiveFlexibleDummyConstructor.route(250, dummy_schema.action_name);
    await fixture.opsHelper.processOp('config_update', 'steemmonsters', {
        updates: [{ group_name: 'validator', name: 'reward_start_block', value: JSON.stringify(280) }],
    });
    const after = ActiveFlexibleDummyConstructor.route(250, dummy_schema.action_name);
    expect(before).toBe(ActiveFlexibleDummyConstructor.builder);
    expect(after).toBeNull();
});

const ActiveSimpleTo = new Router({ to_block: 100 });
const ActiveSimpleFrom = new Router({ from_block: 100 });
const SimpleBothRouter = new MultiActionRouter(ActiveSimpleFrom, ActiveSimpleTo);

test.dbOnly('Handover Test', async () => {
    LookupWrapper.computeAndWatch(SimpleBothRouter, fixture.loader, 'my-test-watch');
    const before = SimpleBothRouter.route(50, dummy_schema.action_name);
    const after = SimpleBothRouter.route(150, dummy_schema.action_name);
    expect(before).toBe(ActiveSimpleTo.builder);
    expect(after).toBe(ActiveSimpleFrom.builder);
});

const ActiveTo = new Router({ to_block: (c) => coerceToBlockNum(c?.reward_start_block) ?? Number.MAX_SAFE_INTEGER });
const ActiveFrom = new Router({ from_block: (c) => coerceToBlockNum(c?.reward_start_block) ?? Number.MAX_SAFE_INTEGER });
const FullBothRouter = new MultiActionRouter(ActiveTo, ActiveFrom);

test.dbOnly('Dynamic Handover Test', async () => {
    LookupWrapper.computeAndWatch(FullBothRouter, fixture.loader, 'my-test-watch');
    const before = FullBothRouter.route(200, dummy_schema.action_name);
    const after = FullBothRouter.route(210, dummy_schema.action_name);
    expect(before).toBe(ActiveTo.builder);
    expect(after).toBe(ActiveFrom.builder);
});
