import { BookkeepingDefault, BookkeepingFromConfig, BookkeepingWatch } from './bookkeeping';

describe('Bookkeeping', () => {
    let unit_under_test: BookkeepingFromConfig;

    it.each`
        account            | expected | accounts             | mode
        ${'$SOME_ACCOUNT'} | ${true}  | ${[]}                | ${BookkeepingDefault.DOLLAR_ONLY}
        ${'$'}             | ${true}  | ${[]}                | ${BookkeepingDefault.DOLLAR_ONLY}
        ${'player-b'}      | ${false} | ${[]}                | ${BookkeepingDefault.DOLLAR_ONLY}
        ${''}              | ${false} | ${[]}                | ${BookkeepingDefault.DOLLAR_ONLY}
        ${'@SOME_ACCOUNT'} | ${false} | ${[]}                | ${BookkeepingDefault.DOLLAR_ONLY}
        ${'$SOME_ACCOUNT'} | ${true}  | ${['$SOME_ACCOUNT']} | ${BookkeepingDefault.DOLLAR_ONLY}
        ${'$'}             | ${false} | ${['$SOME_ACCOUNT']} | ${BookkeepingDefault.DOLLAR_ONLY}
        ${'player-b'}      | ${false} | ${['$SOME_ACCOUNT']} | ${BookkeepingDefault.DOLLAR_ONLY}
        ${''}              | ${false} | ${['$SOME_ACCOUNT']} | ${BookkeepingDefault.DOLLAR_ONLY}
        ${'@SOME_ACCOUNT'} | ${false} | ${['$SOME_ACCOUNT']} | ${BookkeepingDefault.DOLLAR_ONLY}
        ${'$SOME_ACCOUNT'} | ${false} | ${[]}                | ${BookkeepingDefault.NONE}
        ${'$'}             | ${false} | ${[]}                | ${BookkeepingDefault.NONE}
        ${'player-b'}      | ${false} | ${[]}                | ${BookkeepingDefault.NONE}
        ${''}              | ${false} | ${[]}                | ${BookkeepingDefault.NONE}
        ${'@SOME_ACCOUNT'} | ${false} | ${[]}                | ${BookkeepingDefault.NONE}
        ${'$SOME_ACCOUNT'} | ${true}  | ${['$SOME_ACCOUNT']} | ${BookkeepingDefault.NONE}
        ${'$'}             | ${false} | ${['$SOME_ACCOUNT']} | ${BookkeepingDefault.NONE}
        ${'player-b'}      | ${false} | ${['$SOME_ACCOUNT']} | ${BookkeepingDefault.NONE}
        ${''}              | ${false} | ${['$SOME_ACCOUNT']} | ${BookkeepingDefault.NONE}
        ${'@SOME_ACCOUNT'} | ${false} | ${['$SOME_ACCOUNT']} | ${BookkeepingDefault.NONE}
    `('[$#] Mode: $mode, accounts: $accounts, account: $account, expected: $expected', async ({ account, expected, accounts, mode }) => {
        const watcher: BookkeepingWatch = {
            removeBookkeepingWatcher: jest.fn(),
            addBookkeepingWatcher: jest.fn(),
            bookkeeping: { accounts },
        };
        unit_under_test = new BookkeepingFromConfig(watcher, mode);

        await unit_under_test.prime();

        expect(unit_under_test.is_bookkeeping_account(account)).toBe(expected);
    });
});
