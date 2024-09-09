import { TopRouter } from './ActionConstructor';

// Extension point for DI
export type TopActionRouter = TopRouter;
export const TopActionRouter: unique symbol = Symbol.for('TopActionRouter');

// Extension point for DI
export type VirtualActionRouter = TopRouter;
export const VirtualActionRouter: unique symbol = Symbol.for('VirtualActionRouter');

export { default as AdminAction } from './admin_action';
export * from './test_action';
export { default as Action } from './action';
export type { IAction } from './action';
