import { validateAccountName } from 'splinterlands-dhive-sl';

export function isSystemAccount(value: string): boolean {
    return /^\$[A-Z_]*$/.test(value);
}

export function isHiveAccount(value: string): boolean {
    return validateAccountName(value).status === 'success';
}

export function isLiteAccount(value: string): boolean {
    return value.includes('_') && isHiveAccount(value.replace('_', ''));
}
