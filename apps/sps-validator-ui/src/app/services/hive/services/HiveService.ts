import { Hive } from '../core/Hive';
import { Client } from '@hiveio/dhive';
import { CustomJsonErrorResult, CustomJsonSuccessResult, Key } from '../keychain';

type ApproveValidatorPayload = {
    account_name: string;
};

type DisapproveValidatorPayload = {
    account_name: string;
};

type RegisterPayload = {
    is_active: boolean;
    post_url: string | null;
    reward_account: string | null;
};

const NO_HIVE_KEYCHAIN_EXTENSION_ERROR_MESSAGE = 'Hive Keychain extension is not installed, or not available to this page.';

export class HiveService {
    public static isSigningKey(value: string): value is Key {
        switch (value) {
            case 'Active':
            case 'Posting':
            case 'Memo':
                return true;
            default:
                return false;
        }
    }

    public static authorize(account: string): Promise<boolean> {
        return new Promise((resolve, reject) => {
            if (!window.hive_keychain) {
                return reject(new Error(NO_HIVE_KEYCHAIN_EXTENSION_ERROR_MESSAGE));
            }

            window.hive_keychain.requestSignBuffer(account, `auth_check${Date.now()}`, 'Active', (result) => {
                resolve(result.success);
            });
        });
    }

    public static async getHeadBlock(): Promise<{ num: number; time: Date }> {
        const client = new Client(['https://anyx.io']);

        const b = await client.blockchain.getCurrentBlockHeader();
        const num = await client.blockchain.getCurrentBlockNum();
        const block = await client.database.getBlock(num);

        return { num, time: new Date(`${block.timestamp}Z`) };
    }

    public static requestCustomJson(id: string, key: Key, payload: any, message: string): Promise<CustomJsonSuccessResult | CustomJsonErrorResult> {
        return new Promise((resolve, reject) => {
            if (!window.hive_keychain) {
                return reject(new Error(NO_HIVE_KEYCHAIN_EXTENSION_ERROR_MESSAGE));
            }

            window.hive_keychain.requestCustomJson(null, id, key, JSON.stringify(payload), message, (result) => {
                resolve(result);
            });
        });
    }

    public static approveValidator(payload: ApproveValidatorPayload, msg?: string): Promise<CustomJsonSuccessResult | CustomJsonErrorResult> {
        const display_msg = msg ?? `Approve ${payload.account_name} as a validator`;

        return new Promise((resolve, reject) => {
            if (!window.hive_keychain) {
                return reject(new Error(NO_HIVE_KEYCHAIN_EXTENSION_ERROR_MESSAGE));
            }

            window.hive_keychain.requestCustomJson(null, `${Hive.PREFIX}approve_validator`, 'Active', JSON.stringify(payload), display_msg, (result) => {
                resolve(result);
            });
        });
    }

    public static disapproveValidator(payload: DisapproveValidatorPayload, msg?: string): Promise<CustomJsonSuccessResult | CustomJsonErrorResult> {
        const display_msg = msg ?? `Disapprove ${payload.account_name} as validator`;

        return new Promise((resolve, reject) => {
            if (!window.hive_keychain) {
                return reject(new Error(NO_HIVE_KEYCHAIN_EXTENSION_ERROR_MESSAGE));
            }

            window.hive_keychain.requestCustomJson(null, `${Hive.PREFIX}unapprove_validator`, 'Active', JSON.stringify(payload), display_msg, (result) => {
                resolve(result);
            });
        });
    }

    public static updateValidator(payload: RegisterPayload, account: string, msg?: string): Promise<CustomJsonSuccessResult | CustomJsonErrorResult> {
        const display_msg = msg ?? `Register as a validator`;

        return new Promise((resolve, reject) => {
            if (!window.hive_keychain) {
                return reject(new Error(NO_HIVE_KEYCHAIN_EXTENSION_ERROR_MESSAGE));
            }

            window.hive_keychain.requestCustomJson(account, `${Hive.PREFIX}update_validator`, 'Active', JSON.stringify(payload), display_msg, (result) => {
                resolve(result);
            });
        });
    }
}
