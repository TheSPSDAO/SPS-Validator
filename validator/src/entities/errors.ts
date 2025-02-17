import { IAction } from '../actions/action';
import { StrictNumericEnumParam } from '../libs/strict-enum';

export type LogObj = {
    message: string;
    code: number;
    action: string;
};

export enum ErrorType {
    AdminOnly = 2,
    InvalidConfig = 3,
    TestError = 10,
    AmountNotPositive = 30,
    InsufficientBalance = 31,
    MisconfiguredValidator = 42,
    NoSystemAccount = 101,
    SelfTransfer = 112,
    AccountNotKnown = 113,
    NoMultiTokenTransfer = 114,
    MismatchedAccount = 115,
    DuplicateAccount = 116,
    ActiveUnstaking = 132,
    NoStakingToken = 141,
    NoActiveUnstaking = 142,
    ActiveKeyRequired = 143,
    DelegationNotSupportedForToken = 144,
    CannotDelegateToSelf = 145,
    CannotUndelegateToSelf = 146,
    NoTokensDelegated = 147,
    UndelegationTooSoon = 148,
    UndelegationAmountTooHigh = 149,
    NoUndelegationPending = 150,
    NoActiveDelegation = 151,
    CannotUndelegateMoreThanPending = 152,
    DelegationAuthorityNotAllowed = 153,
    UnknownValidator = 210,
    InactiveValidator = 211,
    DoubleValidatorVote = 212,
    MaxValidatorVotes = 213,
    NoSuchValidatorVote = 221,
    NoSuchBlock = 230,
    WrongBlockValidator = 231,
    OldBlock = 232,
    AlreadyValidatedBlock = 233,
    BlockHashMismatch = 234,
    BlockValidationPaused = 235,
    NoSuchSale = 330,
    SaleNotStarted = 331,
    SaleOutOfStock = 332,
    MaxPerSale = 333,
    SaleDiscountMismatch = 334,
    SaleOfferMismatch = 335,
    UnsupportedToken = 336,
    AutonomousPoolAlreadyRegistered = 401,
    AutonomousPoolInvalid = 402,
    AutonomousPoolWithoutName = 403,
    AutonomousPoolNotRegistered = 404,
    TokenAlreadyRegistered = 501,
    AutonomousMintInvalid = 502,
    TokenReferenceNotFound = 503,
    NoAuthority = 600,
    InvalidRewardDelegationPercent = 700,
    InvalidRewardPoolType = 701,
    InvalidRewardPoolToken = 702,
    RewardPoolClaimCooldown = 703,
    RewardPoolIgnoredAccount = 704,
    InvalidPromiseType = 800,
    PromiseAlreadyExists = 801,
    InvalidPromise = 802,
    InvalidPromiseStatus = 803,
    NotPromiseController = 804,
    DelegationPromiseTokenMismatch = 805,
    InvalidPromiseParams = 806,
    // TODO stop defining sps specific errors in the lib.
    InvalidCheckIn = 900,
}

export type ActionIdentifier = Pick<IAction, 'id'>;

export class ActionError extends Error {
    readonly log_obj: {
        message: string;
        code: number;
        action: string;
    };

    // TODO: Possible circular dependency with Action
    constructor(message: string, private readonly action: ActionIdentifier, private readonly code: number) {
        super(message);
        this.name = this.constructor.name;
        this.action = action;
        this.code = code;
        this.log_obj = {
            message: this.message,
            code: this.code,
            action: this.action.id,
        };
    }
}

export class ValidationError<Value extends ErrorType> extends ActionError {
    constructor(message: string, action: ActionIdentifier, code: StrictNumericEnumParam<ErrorType, Value>) {
        super(message, action, code);
    }
}
