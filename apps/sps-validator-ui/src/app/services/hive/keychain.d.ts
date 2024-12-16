type Key = 'Posting' | 'Active' | 'Memo';
type RequestCustomJsonCallback = (result: CustomJsonSuccessResult | CustomJsonErrorResult) => void;

type CustomJsonSuccessResult = {
    success: true;
    error: null;
    message: string;
    request_id: number;
    result: {
        id: string;
        ref_block_num: number;
        ref_block_prefix: number;
        expiration: string;
        signatures: string[];
        operations: unknown[];
        extensions: unknown[];
    };
};

type CustomJsonErrorResult = {
    success: false;
    result: null;
    message: string;
    error: string;
    request_id: number;
    data: {
        request_id: number;
        type: string;
        username: string | null;
        id: string;
        method: string;
        json: string;
        display_msg: string;
    };
};
interface Keychain {
    // TODO: More to be added
    /*
    The function `requestSignBuffer` mentions in the docs that the first parameter is optional, and later parameters are
    not, this is not possible in JavaScript as far as I know, so perhaps it's some form of overload, but the second
    parameter is also a string, which makes this hard to detect.

    For now I only added what I needed.
     */
    requestCustomJson(account: string | null, id: string, key: Key, json: string, display_msg: string, callback: RequestCustomJsonCallback, rpc: string | null = null): void;

    requestSignBuffer(account: string, message: string, key: Key, callback: (result: { success: boolean }) => void): void;
}

export declare global {
    interface Window {
        hive_keychain?: Keychain;
    }
}
