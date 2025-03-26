import { Button, Card, CardBody, Chip, List, ListItem, Spinner, Tooltip, Typography } from '@material-tailwind/react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { localeNumber } from '../../components/LocaleNumber';
import { GradientOverflow, Table, TableBody, TableCell, TableHeader, TableRow } from '../../components/Table';
import { usePromise } from '../../hooks/Promise';
import { DefaultService, Transaction } from '../../services/openapi';
import React, { useRef, useState } from 'react';
import { OmniBox } from './OmniBox';
import { AccountChip, BlockTimeChip, TxStatusChip, TxTypeChip } from './Chips';
import { listItemClickHandler } from './utils';
import { useSpinnerColor } from '../../hooks/SpinnerColor';

function AccountInfo({ account, className }: { account: string | null; className?: string }) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const spinnerColor = useSpinnerColor("blue");
    const [accountData, isAccountLoading] = usePromise(async () => {
        try {
            if (!account) {
                return undefined;
            }
            return await DefaultService.getAccount(account);
        } catch (e) {
            // api returns a 404 for non-existent blocks so we just catch the exception
            return undefined;
        }
    }, [account]);
    const [validator, isValidatorLoading] = usePromise(async () => {
        try {
            return await DefaultService.getValidator(account ?? undefined);
        } catch (e) {
            return undefined;
        }
    }, [account]);
    return (
        <Card className={className}>
            <CardBody>
                <div className="flex align-middle justify-between sm:justify-start mb-3">
                    <Typography variant="h5" color="blue-gray" className="dark:text-gray-200 self-center">
                        Account {account}
                    </Typography>
                    {account != null && (
                        <img src={`https://images.hive.blog/u/${account}/avatar`} className="inline-block rounded-full border dark:border-gray-300 sm:ml-3 h-10 w-10" alt={account ?? 'User Avatar'} />
                    )}
                </div>

                {isAccountLoading && (
                    <div className="flex justify-center">
                        <Spinner color={spinnerColor} />
                    </div>
                )}

                {!isAccountLoading && !accountData && (
                    <Typography variant="paragraph" color="blue-gray" className="dark:text-gray-300">
                        Account not found
                    </Typography>
                )}

                {!isAccountLoading && accountData && (
                    <div className="relative">
                        <div ref={containerRef} className="overflow-x-auto">
                        <Table className="w-full">
                            <TableBody>
                                <TableRow>
                                    <TableCell className="font-bold dark:text-gray-300 dark:border-gray-300">Hive Account</TableCell>
                                    <TableCell className="dark:border-gray-300">
                                        <Link to={`https://hivehub.dev/@${account}`} target="_blank" rel="noopener noreferrer" className="text-blue-gray-800 underline dark:text-gray-400">
                                            {account}
                                        </Link>
                                    </TableCell>
                                </TableRow>
                                <TableRow>
                                    <TableCell className="font-bold dark:text-gray-300 dark:border-gray-300">Validator Node</TableCell>
                                    <TableCell className="dark:border-gray-300">
                                        {isValidatorLoading && <Spinner color={spinnerColor} />}
                                        {!isValidatorLoading && !validator && 'Not a validator'}
                                        {!isValidatorLoading && validator && (
                                            <Link to={`/validator-nodes?node=${account}`} className="text-blue-gray-800 underline dark:text-gray-400">
                                                {account}
                                            </Link>
                                        )}
                                    </TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                    </div>
                    <GradientOverflow isLoading={isAccountLoading} containerRef={containerRef}/>
                    </div>
                )}
            </CardBody>
        </Card>
    );
}

function AccountBalances({ account, className }: { account: string | null; className?: string }) {
    const [balances, loading] = usePromise(() => DefaultService.getExtendedBalances(account ?? ''), [account]);
    const containerRef = useRef<HTMLDivElement | null>(null);
    return (
        <Card className={className}>
            <CardBody>
                <Typography variant="h5" color="blue-gray" className="mb-6 dark:text-gray-200">
                    Account Balances for {account}
                </Typography>
                {loading && <Typography variant="paragraph" className="dark:text-gray-300">Loading...</Typography>}
                {balances && (
                    <div className="relative">
                        <div ref={containerRef} className="overflow-x-auto">
                            <Table className="w-full border-2 border-gray-200 dark:border-gray-300">
                                <TableHeader columns={["Token", "Balance"]} />
                                <TableBody>
                                    {balances.map((balance) => (
                                        <TableRow key={balance.token}>
                                            <TableCell>{balance.token}</TableCell>
                                            <TableCell>{localeNumber(balance.balance)}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                        <GradientOverflow isLoading={loading} containerRef={containerRef}/>
                    </div>
                )}
            </CardBody>
        </Card>
    );
}

function TransactionList({ account, className }: { account: string | null; className?: string }) {
    const navigate = useNavigate();
    const [limit] = useState(15);
    const [sort, setSort] = useState<'asc' | 'desc'>('desc');
    const [txOffset, setTxOffset] = useState<Transaction | null>(null);
    const spinnerColor = useSpinnerColor("blue");
    const [transactions, isTransactionsLoading] = usePromise(async () => {
        try {
            if (!account) {
                return [];
            }
            const txs = await DefaultService.getAccountTransactions(account, limit, txOffset?.block_num, txOffset?.index, sort);
            // always sort the transactions by block_num desc and index asc
            txs.sort((a, b) => {
                if (a.block_num === b.block_num) {
                    return a.index - b.index;
                }
                return b.block_num - a.block_num;
            });
            return txs;
        } catch (e) {
            return [];
        }
    }, [account, txOffset, sort]);

    const page = (direction: 'next' | 'prev') => {
        if (direction === 'next') {
            setSort('desc');
            setTxOffset(transactions?.[transactions.length - 1] ?? null);
        } else {
            setSort('asc');
            setTxOffset(transactions?.[0] ?? null);
        }
    };

    return (
        <Card className={className}>
            <CardBody>
                <div className="flex flex-col  sm:flex-row w-full mb-3">
                    <Typography variant="h5" color="blue-gray" className="dark:text-gray-200 text-wrap mb-3 sm:mb-0">
                        Transactions for {account}
                    </Typography>
                    <div className="ml-auto flex gap-2 sm:gap-3 items-center">
                        <Button variant="outlined" className="px-2 py-2 sm:px-6 sm:py-3 sm:gap-1 dark:bg-blue-800 dark:hover:bg-blue-600 dark:border-gray-300 dark:border dark:text-gray-300 dark:hover:text-gray-100 dark:shadow-none" onClick={() => page('prev')}>
                            Previous Page
                        </Button>
                        <Button variant="outlined" className="px-2 py-2 sm:px-6 sm:py-3 sm:gap-1 dark:bg-blue-800 dark:hover:bg-blue-600 dark:border-gray-300 dark:border dark:text-gray-300 dark:hover:text-gray-100 dark:shadow-none" onClick={() => page('next')}>
                            Next Page
                        </Button>
                    </div>
                </div>
                {isTransactionsLoading && (
                    <div className="flex justify-center">
                        <Spinner color={spinnerColor} />
                    </div>
                )}

                {!isTransactionsLoading && (!transactions || transactions.length === 0) && (
                    <Typography variant="paragraph" color="blue-gray"  className="dark:text-gray-300">
                        No transactions found
                    </Typography>
                )}

                {!isTransactionsLoading && transactions && transactions.length > 0 && (
                    <List className="p-0 ">
                        {transactions.map((tx, i) => (
                            <React.Fragment key={tx.id}>
                                <ListItem onClick={listItemClickHandler(() => navigate(`/block-explorer/transaction?id=${tx.id}`))} className="cursor-pointer outer-list-item group dark:hover:bg-gray-300 dark:focus:bg-gray-300">
                                    <div className="pointer-events-none">
                                        <div className="mb-2">
                                            <Typography variant="paragraph" color="blue-gray" className="flex md:items-center gap-2 flex-col md:flex-row mb-2 md:mb-0 dark:text-gray-300 dark:group-hover:text-gray-800 dark:group-focus:text-gray-800">
                                                <Link to={`/block-explorer/transaction?id=${tx.id}`} className="font-semibold underline text-blue-gray-800 dark:text-gray-400 dark:group-hover:text-gray-900 dark:group-focus:text-gray-900 break-all">
                                                    {tx.id}
                                                </Link>{' '}
                                                <span className="hidden md:block">|{' '}</span>
                                                <Link to={`/block-explorer/block?block=${tx.block_num}`} className="pointer-events-auto font-semibold underline text-blue-gray-800 dark:text-gray-400 dark:group-hover:text-gray-900 dark:group-focus:text-gray-900">
                                                    Block {tx.block_num}
                                                </Link>
                                                {tx.id.includes('_') && <Chip variant="outlined" value="virtual" className="ml-2 rounded-full inline italic dark:text-gray-300 dark:border-gray-300 dark:group-hover:text-gray-800 dark:group-hover:border-gray-800 dark:group-focus:text-gray-800 dark:group-focus:border-gray-800" />}
                                            </Typography>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2 w-full">
                                            <TxTypeChip type={tx.type} className="pointer-events-auto dark:text-gray-800 dark:bg-gray-300 dark:group-hover:bg-gray-800 dark:group-hover:text-gray-300 dark:group-focus:bg-gray-800 dark:group-focus:text-gray-300" />
                                            <TxStatusChip success={tx.success ?? false} error={tx.error} className="pointer-events-auto" />
                                            <BlockTimeChip blockTime={tx.created_date} className=" pointer-events-auto dark:text-gray-800 dark:bg-gray-300 dark:group-hover:bg-gray-800 dark:group-hover:text-gray-300 dark:group-focus:bg-gray-800 dark:group-focus:text-gray-300" />
                                            <AccountChip account={tx.player} className="hidden md:block pointer-events-auto dark:text-gray-300 dark:border-gray-300 dark:group-hover:text-gray-800 dark:group-hover:border-gray-800 dark:group-focus:text-gray-800 dark:group-focus:border-gray-800" />
                                            {account != null && (
                                                <Tooltip content={account ?? 'Account Avatar'}  className="dark:bg-gray-600 dark:text-gray-100">
                                                    <img src={`https://images.hive.blog/u/${account}/avatar`} className="pointer-events-auto inline-block rounded-full border dark:border-gray-300 h-7 w-7 md:hidden" alt={account ?? 'Account Avatar'} />
                                                </Tooltip>
                                            )}
                                        </div>
                                    </div>
                                </ListItem>
                                {i !== transactions.length - 1 && <hr className="my-0 opacity-75 border-blue-gray-200 dark:border-gray-300" />}
                            </React.Fragment>
                        ))}
                    </List>
                )}
            </CardBody>
        </Card>
    );
}

export function Account() {
    const [searchParams] = useSearchParams({ account: '' });
    const account = searchParams.get('account');
    //
    return (
        <div className="grid grid-cols-1 place-items-center gap-4">
            <OmniBox className="2xl:w-3/4 w-full" />
            <AccountInfo className="2xl:w-3/4 w-full dark:bg-gray-800 dark:text-gray-300" account={account} />
            <AccountBalances className="2xl:w-3/4 w-full dark:bg-gray-800 dark:text-gray-300" account={account} />
            <TransactionList className="2xl:w-3/4 w-full dark:bg-gray-800 dark:text-gray-300" account={account} />
        </div>
    );
}
