export interface AdminMembership {
    isAdmin(account: string): Promise<boolean>;
}

export const AdminMembership: unique symbol = Symbol('AdminMembership');

export const AdminMembershipHelpers = {
    fromConst: (account: string, ...accounts: string[]) => {
        const allAccounts = [account, ...accounts];
        return {
            async isAdmin(account: string): Promise<boolean> {
                return allAccounts.includes(account);
            },
        };
    },
    fromFn: (fn: (account: string) => Promise<boolean>) => {
        return {
            async isAdmin(account: string): Promise<boolean> {
                return fn(account);
            },
        };
    },
};
