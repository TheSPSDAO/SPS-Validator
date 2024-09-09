export type TokenTransfer = OkTokenTransfer | ErrTokenTransfer;

export type Transaction = {
    readonly id: string;
    readonly block_id: string;
    readonly prev_block_id: string;
    readonly type: string;
    readonly player: string;
    readonly data: any;
    readonly success: boolean;
    readonly error: any | null;
    readonly block_num: number;
    readonly created_date: Date | null;
    readonly result: any | null;
};

type BaseTokenTransfer = {
    readonly id: string;
    readonly from: string;
    readonly to: string;
    readonly qty: number;
    readonly token: string;
    readonly memo: string;
};

export type OkTokenTransfer = BaseTokenTransfer & {
    // Discriminator
    readonly success: true;
};

export type ErrTokenTransfer = BaseTokenTransfer & {
    // Discriminator
    readonly success: false;
    readonly error: {
        readonly message: string;
        readonly code: number;
    };
};
