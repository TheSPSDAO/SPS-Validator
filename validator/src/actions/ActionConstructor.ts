import { OperationData } from '../entities/operation';
import { IAction } from './action';
import { DeepImmutable } from '@steem-monsters/atom';
import { ValidatorConfig } from '../config';
import { PrecomputedMultiRouter, PrecomputedRouter } from '../libs/routing/precompute';
import { IRouter, Route as GenericRoute } from '../libs/routing';

export interface ActionFactory<T extends IAction> {
    build(op: OperationData, data: unknown, index?: number): T;
}

export function asActionFactory<T extends IAction>(fn: (op: OperationData, data: unknown, index?: number) => T) {
    return <ActionFactory<T>>{
        build: fn,
    };
}

export type Compute = DeepImmutable<ValidatorConfig> | undefined;
export const Route = class extends GenericRoute<Compute, ActionFactory<IAction>> {};
export type Route = GenericRoute<Compute, ActionFactory<IAction>>;
export type RouterType = IRouter<ActionFactory<IAction>, Compute>;
export class ActionRouter<T extends IAction> extends PrecomputedRouter<ActionFactory<T>, Compute> {}
export class MultiActionRouter extends PrecomputedMultiRouter<ActionFactory<IAction>, Compute> {}

export type TopRouter = IRouter<ActionFactory<IAction>, Compute>;
