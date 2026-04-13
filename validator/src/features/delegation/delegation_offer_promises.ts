import { Result } from '@steem-monsters/lib-monad';
import { PromiseEntity, Trx } from '../../db/tables';
import { IAction } from '../../actions';
import { EventLog } from '../../entities/event_log';
import {
    HandlerCompletePromiseRequest,
    HandlerCreatePromiseRequest,
    HandlerCreateResult,
    HandlerFulfillPromiseRequest,
    HandlerFulfillPromisesRequest,
    HandlerFulfillPromiseResult,
    PromiseHandler,
    HandlerReversePromiseRequest,
    HandlerCreatePromiseResult,
} from '../promises';
import { DelegationManager } from './delegation_manager';
import { ErrorType, ValidationError } from '../../entities/errors';
import { object, number, string } from 'yup';
import { token, qty, hiveAccount } from '../../actions/schema';
import { RentalDelegationRepository } from '../../entities/rental/rental_delegation';
import { PromiseRepository } from '../../entities/promises/promise';
import { ReadOnlyWatcher } from '../../config';

export type DelegationRentalConfig = {
    qty_divisor: number;
    min_qty: number;
};

export const delegation_rental_schema = object({
    qty_divisor: number().required().min(1),
    min_qty: number().required().min(0),
});

export type DelegationRentalWatch = ReadOnlyWatcher<'delegation_rental', DelegationRentalConfig>;
export const DelegationRentalWatch: unique symbol = Symbol('DelegationRentalWatch');

export type DelegationOfferPromiseHandlerOpts = {
    delegation_promise_account: string;
    /**
     * Block number at which controller-based creation and null promise IDs become enabled.
     * Before this block, only the lender can create offers, and IDs are required.
     */
    delegation_offer_transition_block: number;
    /**
     * Default qty_divisor if config watch is not provided or doesn't have a value.
     */
    default_qty_divisor?: number;
    /**
     * Default min_qty if config watch is not provided or doesn't have a value.
     */
    default_min_qty?: number;
};

/**
 * Schema for the params stored on a delegation_offer promise.
 * - token: the token being delegated (e.g., SPSP)
 * - qty: the total quantity of tokens offered for rent
 * - lender: the account offering the delegation (the SPS holder)
 * - expiration_blocks: how many blocks each rental lasts once filled
 * - qty_remaining: tracks unfilled quantity (set on create, decremented on fill)
 * - source_promise_id: (optional) if a controller creates the promise on behalf of a lender,
 *   this references the promise ID that grants them controller authority.
 */
const delegation_offer_params_schema = object({
    token: token,
    qty: qty.positive(),
    lender: hiveAccount.required(),
    price: qty.positive(),
    qty_remaining: number().min(0).optional(),
    source_promise_id: string().strict().optional(),
});

export type DelegationOfferParams = typeof delegation_offer_params_schema['__outputType'];

/**
 * Metadata passed when a delegation offer is fulfilled (a borrower rents the SPS).
 * - borrower: the account that will receive the delegated tokens
 * - rental_id: a unique ID for this rental (used as the rental_delegations record ID)
 * - qty: the amount of the offer to fill (supports partial fills)
 */
const delegation_offer_fulfill_metadata_schema = object({
    borrower: hiveAccount.required(),
    rental_id: token, // reuses the 'required string' validator
    qty: qty.positive(),
    expiration_blocks: number().positive().integer().required(),
});

export type DelegationOfferFulfillMetadata = typeof delegation_offer_fulfill_metadata_schema['__outputType'];

/**
 * This handler implements the "delegation_offer" promise type for the SPS Rental Market V3.
 *
 * Flow:
 *
 * 1. CREATE: The lender sends a create_promise transaction directly. The validator locks the
 *    lender's SPS by delegating it to the $DELEGATION_PROMISES system account. The bridge
 *    observes this event and creates an offer on the order book. Non-admin creation is allowed.
 *
 * 2. FULFILL: When the order book matches a borrower, the bridge sends a fulfill_promise with
 *    metadata specifying qty to fill. Supports partial fills:
 *    - The filled qty of SPS is undelegated from the promises account back to the lender,
 *      then re-delegated from the lender to the borrower.
 *    - A rental_delegations record is created to track the expiration.
 *    - qty_remaining on the promise params is decremented.
 *    - If qty_remaining > 0, the promise stays open for more fills.
 *    - If qty_remaining = 0, the promise transitions to completed.
 *
 * 3. REVERSE: Not allowed for delegation offers. Reversals are rejected with an error.
 *
 * 4. CANCEL: Returns the remaining locked SPSP from the system account back to the lender.
 *    Active rental delegations to borrowers are NOT affected — they continue until expiration.
 *
 * 5. COMPLETE: No-op. Completion is driven by the fulfill handler when qty_remaining hits 0.
 */
export class DelegationOfferPromiseHandler extends PromiseHandler {
    private static readonly DEFAULT_QTY_DIVISOR = 500;
    private static readonly DEFAULT_MIN_QTY = 500;

    constructor(
        private readonly opts: DelegationOfferPromiseHandlerOpts,
        private readonly delegationManager: DelegationManager,
        private readonly rentalDelegationRepository: RentalDelegationRepository,
        private readonly promiseRepository: PromiseRepository,
        private readonly configWatch?: DelegationRentalWatch,
    ) {
        super();
    }

    private get qtyDivisor(): number {
        return this.configWatch?.delegation_rental?.qty_divisor ?? this.opts.default_qty_divisor ?? DelegationOfferPromiseHandler.DEFAULT_QTY_DIVISOR;
    }

    private get minQty(): number {
        return this.configWatch?.delegation_rental?.min_qty ?? this.opts.default_min_qty ?? DelegationOfferPromiseHandler.DEFAULT_MIN_QTY;
    }

    /**
     * Delegation offers are created directly by the lender, not by admins.
     */
    override requiresAdminForCreate(): boolean {
        return false;
    }

    /**
     * Delegation offers can only be created after the controller_creation_block transition.
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    override async canCreate(action: IAction, _trx?: Trx): Promise<Result<void, Error>> {
        if (action.op.block_num < this.opts.delegation_offer_transition_block) {
            return Result.Err(new ValidationError('Delegation offer promises cannot be created before the transition block.', action, ErrorType.TransitionRequired));
        }
        return Result.OkVoid();
    }

    // ─── CREATE ────────────────────────────────────────────────────────────────
    // Lender creates the promise directly. Locks SPS into $DELEGATION_PROMISES.

    override async validateCreatePromise(request: HandlerCreatePromiseRequest, action: IAction, trx?: Trx): Promise<Result<HandlerCreatePromiseResult, Error>> {
        // Delegation offer promises must not have a fulfill_timeout_seconds
        if (request.fulfill_timeout_seconds !== undefined && request.fulfill_timeout_seconds !== null) {
            return Result.Err(new ValidationError('Delegation offer promises cannot have a fulfill_timeout_seconds.', action, ErrorType.InvalidPromiseParams));
        } else if (request.id) {
            return Result.Err(new ValidationError('id parameter must not be provided. Promise ID is auto-generated by the system.', action, ErrorType.InvalidPromiseParams));
        }

        const valid = delegation_offer_params_schema.isValidSync(request.params);
        if (!valid) {
            return Result.Err(new ValidationError('Invalid delegation offer parameters.', action, ErrorType.InvalidPromiseParams));
        }

        const params = request.params as DelegationOfferParams;

        // Validate qty is divisible by the configured divisor
        const qtyDivisor = this.qtyDivisor;
        if (qtyDivisor > 1 && params.qty % qtyDivisor !== 0) {
            return Result.Err(new ValidationError(`Offer qty must be a multiple of ${qtyDivisor}.`, action, ErrorType.InvalidPromiseParams));
        }

        // Validate qty meets minimum
        const minQty = this.minQty;
        if (minQty > 0 && params.qty < minQty) {
            return Result.Err(new ValidationError(`Offer qty must be at least ${minQty}.`, action, ErrorType.InvalidPromiseParams));
        }

        // Check authority: either the lender themselves, or a controller acting on behalf of the lender
        if (params.lender !== action.op.account) {
            // Allow controller creation if source_promise_id is provided
            if (!params.source_promise_id) {
                return Result.Err(new ValidationError('Controller must provide source_promise_id to create offer on behalf of lender.', action, ErrorType.NoAuthority));
            }

            // Look up the source promise to verify controller authority
            const sourcePromise = await this.promiseRepository.getPromiseByTypeAndId('delegation_offer', params.source_promise_id, trx);
            if (!sourcePromise) {
                return Result.Err(new ValidationError(`Source promise ${params.source_promise_id} not found.`, action, ErrorType.InvalidPromise));
            }

            // Verify the calling account is a controller on the source promise
            if (!sourcePromise.controllers.includes(action.op.account)) {
                return Result.Err(new ValidationError('Account is not a controller on the source promise.', action, ErrorType.NotPromiseController));
            }

            // Verify the source promise's lender matches the new promise's lender
            const sourceParams = sourcePromise.params as DelegationOfferParams;
            if (sourceParams.lender !== params.lender) {
                return Result.Err(new ValidationError('Source promise lender does not match the lender in the new promise.', action, ErrorType.NoAuthority));
            }
        }

        // Validate the delegation is possible (token supports delegation, valid account, qty > 0)
        const delegationValid = await this.delegationManager.validateDelegation(
            {
                from: params.lender,
                to: this.opts.delegation_promise_account,
                qty: params.qty,
                token: params.token,
                allowSystemAccounts: true,
                skipAuthorityCheck: true,
            },
            action,
            trx,
        );
        if (Result.isErr(delegationValid)) {
            return Result.Err(delegationValid.error);
        }

        return Result.Ok({ allowNonAdmin: true });
    }

    override async createPromise(request: HandlerCreatePromiseRequest, action: IAction, trx?: Trx): Promise<HandlerCreateResult> {
        const params = request.params as DelegationOfferParams;

        // Set qty_remaining to the full qty on creation
        const storedParams: DelegationOfferParams = {
            ...params,
            qty_remaining: params.qty,
        };

        // Lock the lender's SPS by delegating to the promises system account
        const logs = await this.delegationManager.delegate(
            {
                from: params.lender,
                to: this.opts.delegation_promise_account,
                qty: params.qty,
                token: params.token,
                allowSystemAccounts: true,
                skipDateUpdate: true,
            },
            action,
            trx,
        );

        return { logs, params: storedParams };
    }

    // ─── FULFILL (single) ──────────────────────────────────────────────────────
    // A borrower has been matched for a partial or full fill.

    override async validateFulfillPromise(request: HandlerFulfillPromiseRequest, promise: PromiseEntity, action: IAction, trx?: Trx): Promise<Result<void, Error>> {
        const paramsValid = delegation_offer_params_schema.isValidSync(promise.params);
        if (!paramsValid) {
            return Result.Err(new ValidationError('Invalid delegation offer promise parameters.', action, ErrorType.InvalidPromiseParams));
        }

        const metadataValid = delegation_offer_fulfill_metadata_schema.isValidSync(request.metadata);
        if (!metadataValid) {
            return Result.Err(new ValidationError('Invalid delegation offer fulfill metadata. Must include borrower, rental_id, and qty.', action, ErrorType.InvalidPromiseParams));
        }

        const params = promise.params as DelegationOfferParams;
        const metadata = request.metadata as DelegationOfferFulfillMetadata;
        const qtyRemaining = params.qty_remaining ?? params.qty;

        if (metadata.borrower === params.lender) {
            return Result.Err(new ValidationError('Cannot rent delegation to yourself.', action, ErrorType.CannotDelegateToSelf));
        }

        if (metadata.qty > qtyRemaining) {
            // prettier-ignore
            return Result.Err(new ValidationError(`Fill qty ${metadata.qty} exceeds remaining offer qty ${qtyRemaining}.`, action, ErrorType.InsufficientBalance));
        }

        // Validate fill qty is divisible by the configured divisor
        const qtyDivisor = this.qtyDivisor;
        if (qtyDivisor > 1 && metadata.qty % qtyDivisor !== 0) {
            return Result.Err(new ValidationError(`Fill qty must be a multiple of ${qtyDivisor}.`, action, ErrorType.InvalidPromiseParams));
        }

        // Validate fill qty meets minimum
        const minQty = this.minQty;
        if (minQty > 0 && metadata.qty < minQty) {
            return Result.Err(new ValidationError(`Fill qty must be at least ${minQty}.`, action, ErrorType.InvalidPromiseParams));
        }

        // Check that the rental_id doesn't already exist
        const existingRental = await this.rentalDelegationRepository.getById(metadata.rental_id, trx);
        if (existingRental) {
            return Result.Err(new ValidationError(`Rental delegation with id ${metadata.rental_id} already exists.`, action, ErrorType.PromiseAlreadyExists));
        }

        return Result.OkVoid();
    }

    override async fulfillPromise(request: HandlerFulfillPromiseRequest, promise: PromiseEntity, action: IAction, trx?: Trx): Promise<HandlerFulfillPromiseResult> {
        const params = promise.params as DelegationOfferParams;
        const metadata = request.metadata as DelegationOfferFulfillMetadata;
        const fillQty = metadata.qty;
        const qtyRemaining = params.qty_remaining ?? params.qty;
        const newQtyRemaining = qtyRemaining - fillQty;
        const eventLogs: EventLog[] = [];

        // 1. Undelegate the fill qty from the promises account back to the lender
        eventLogs.push(
            ...(await this.delegationManager.undelegate(
                {
                    account: params.lender,
                    to: params.lender,
                    from: this.opts.delegation_promise_account,
                    qty: fillQty,
                    token: params.token,
                    allowSystemAccounts: true,
                    skipDateUpdate: true,
                },
                action,
                trx,
            )),
        );

        // 2. Delegate from lender to borrower
        eventLogs.push(
            ...(await this.delegationManager.delegate(
                {
                    from: params.lender,
                    to: metadata.borrower,
                    qty: fillQty,
                    token: params.token,
                    allowSystemAccounts: false,
                    skipDateUpdate: true,
                },
                action,
                trx,
            )),
        );

        // 3. Create the rental delegation tracking record
        const [_, rentalLogs] = await this.rentalDelegationRepository.create(
            {
                id: metadata.rental_id,
                promise_type: 'delegation_offer',
                promise_ext_id: promise.ext_id,
                lender: params.lender,
                borrower: metadata.borrower,
                token: params.token,
                qty: fillQty,
                expiration_blocks: metadata.expiration_blocks,
                start_block: action.op.block_num,
            },
            action,
            trx,
        );
        eventLogs.push(...rentalLogs);

        // 4. Return the result with updated params and appropriate status
        const updatedParams: DelegationOfferParams = {
            ...params,
            qty_remaining: newQtyRemaining,
        };

        return {
            logs: eventLogs,
            updatedParams,
            // If there's still qty remaining, keep the promise open for more fills.
            // Otherwise, mark as completed (all SPS has been delegated out).
            status: newQtyRemaining > 0 ? 'open' : 'completed',
        };
    }

    // ─── FULFILL (batch) ───────────────────────────────────────────────────────
    // For delegation offers, batch fulfills don't make sense since each fill has
    // unique metadata. Delegate to single fulfill.

    override async validateFulfillPromises(request: HandlerFulfillPromisesRequest, promises: PromiseEntity[], action: IAction, trx?: Trx): Promise<Result<void, Error>> {
        for (const promise of promises) {
            const fulfillRequest: HandlerFulfillPromiseRequest = {
                type: request.type,
                id: promise.ext_id,
                metadata: request.metadata,
            };
            const result = await this.validateFulfillPromise(fulfillRequest, promise, action, trx);
            if (Result.isErr(result)) {
                return result;
            }
        }
        return Result.OkVoid();
    }

    override async fulfillPromises(request: HandlerFulfillPromisesRequest, promises: PromiseEntity[], action: IAction, trx?: Trx): Promise<HandlerFulfillPromiseResult> {
        const eventLogs: EventLog[] = [];
        let lastResult: HandlerFulfillPromiseResult = { logs: [] };
        for (const promise of promises) {
            const fulfillRequest: HandlerFulfillPromiseRequest = {
                type: request.type,
                id: promise.ext_id,
                metadata: request.metadata,
            };
            lastResult = await this.fulfillPromise(fulfillRequest, promise, action, trx);
            eventLogs.push(...lastResult.logs);
        }
        return {
            logs: eventLogs,
            status: lastResult.status,
            updatedParams: lastResult.updatedParams,
        };
    }

    // ─── REVERSE ───────────────────────────────────────────────────────────────
    // Returns the remaining locked SPS from the system account back to the lender.
    // Active rental delegations to borrowers are NOT reversed here — they continue
    // until their individual expiration blocks are reached.

    override async validateReversePromise(_request: HandlerReversePromiseRequest, _promise: PromiseEntity, action: IAction, _trx?: Trx): Promise<Result<void, Error>> {
        return Result.Err(new ValidationError('Delegation offer promises cannot be reversed.', action, ErrorType.InvalidPromiseStatus));
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    override async reversePromise(_request: HandlerReversePromiseRequest, _promise: PromiseEntity, _action: IAction, _trx?: Trx): Promise<EventLog[]> {
        return [];
    }

    // ─── COMPLETE ──────────────────────────────────────────────────────────────
    // Completion is driven by the fulfill handler when qty_remaining hits 0.
    // Manual completion is a no-op.

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    override async validateCompletePromise(_request: HandlerCompletePromiseRequest, promise: PromiseEntity, action: IAction, _trx?: Trx): Promise<Result<void, Error>> {
        return Result.Err(
            new ValidationError(
                'Delegation offer promises are completed automatically when fully filled. Manual completion is not allowed.',
                action,
                ErrorType.InvalidPromiseStatus,
            ),
        );
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    override async completePromise(_request: HandlerCompletePromiseRequest, _promise: PromiseEntity, _action: IAction, _trx?: Trx): Promise<EventLog[]> {
        return [];
    }

    // ─── CANCEL ────────────────────────────────────────────────────────────────
    // Cancels the offer. Returns remaining locked SPS from the system account.
    // Active rental delegations continue until their individual expirations.

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    override async validateCancelPromise(_request: HandlerCompletePromiseRequest, promise: PromiseEntity, action: IAction, _trx?: Trx): Promise<Result<void, Error>> {
        const params = promise.params as DelegationOfferParams;
        if (action.op.account !== params.lender) {
            return Result.Err(new ValidationError('Only the lender can cancel delegation offer promises.', action, ErrorType.NoAuthority));
        }
        return Result.OkVoid();
    }

    override async cancelPromise(request: HandlerCompletePromiseRequest, promise: PromiseEntity, action: IAction, trx?: Trx): Promise<EventLog[]> {
        const params = promise.params as DelegationOfferParams;
        const qtyRemaining = params.qty_remaining ?? params.qty;
        const eventLogs: EventLog[] = [];

        // Unlock the remaining SPS from the system account back to the lender
        if (qtyRemaining > 0) {
            eventLogs.push(
                ...(await this.delegationManager.undelegate(
                    {
                        account: params.lender,
                        to: params.lender,
                        from: this.opts.delegation_promise_account,
                        qty: qtyRemaining,
                        token: params.token,
                        allowSystemAccounts: true,
                        skipDateUpdate: true,
                    },
                    action,
                    trx,
                )),
            );
        }

        return eventLogs;
    }

    override getPromisesNotFoundErrorMessage(ids: string[]): string {
        return `Delegation offers with ids [${ids.join(', ')}] not found.`;
    }

    override getPromisesNotOpenErrorMessage(ids: string[]): string {
        return `Delegation offers with ids [${ids.join(', ')}] are not open.`;
    }
}
