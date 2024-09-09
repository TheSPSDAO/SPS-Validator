import { inject, injectable } from 'tsyringe';
import { ActionFactory, Schema, ActionRouter, autoroute, OperationData, route, TestAction } from '@steem-monsters/splinterlands-validator';

@injectable()
export class Builder implements ActionFactory<TestAction> {
    build(op: OperationData, data: unknown, index?: number) {
        return new TestAction(op, data, index);
    }
}

@injectable()
@autoroute()
export class Router extends ActionRouter<TestAction> {
    @route(Schema.test.action_name, { from_block: 100 })
    readonly builder: Builder;

    constructor(@inject(Builder) builder: Builder) {
        super();
        this.builder = builder;
    }
}
