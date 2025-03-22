import { Button, Card, CardBody, Chip, List, ListItem, Spinner, Typography } from '@material-tailwind/react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { localeNumber } from '../../components/LocaleNumber';
import { GradientOverflow, Table, TableBody, TableCell, TableColumn, TableHead, TableRow } from '../../components/Table';
import { usePromise } from '../../hooks/Promise';
import { DefaultService, Transaction } from '../../services/openapi';
import React, { useRef, useState } from 'react';
import { OmniBox } from './OmniBox';
import { AccountChip, TxStatusChip, TxTypeChip } from './Chips';
import { listItemClickHandler } from './utils';

function AccountInfo({ account, className }: { account: string | null; className?: string }) {
    const containerRef = useRef<HTMLDivElement | null>(null);
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
                <div className="flex mb-3">
                    <Typography variant="h5" color="blue-gray">
                        Account {account}
                    </Typography>
                </div>

                {isAccountLoading && (
                    <div className="flex justify-center">
                        <Spinner />
                    </div>
                )}

                {!isAccountLoading && !accountData && (
                    <Typography variant="paragraph" color="blue-gray">
                        Account not found
                    </Typography>
                )}

                {!isAccountLoading && accountData && (
                    <div className="relative">
                        <div ref={containerRef} className="overflow-x-auto">
                        <Table className="w-full">
                            <TableBody>
                                <TableRow>
                                    <TableCell className="font-bold">Hive Account</TableCell>
                                    <TableCell>
                                        <Link to={`https://hivehub.dev/@${account}`} target="_blank" rel="noopener noreferrer" className="text-blue-gray-800 underline">
                                            {account}
                                        </Link>
                                    </TableCell>
                                </TableRow>
                                <TableRow>
                                    <TableCell className="font-bold">Validator Node</TableCell>
                                    <TableCell>
                                        {isValidatorLoading && <Spinner />}
                                        {!isValidatorLoading && !validator && 'Not a validator'}
                                        {!isValidatorLoading && validator && (
                                            <Link to={`/validator-nodes?node=${account}`} className="text-blue-gray-800 underline">
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
                <Typography variant="h5" color="blue-gray" className="mb-6">
                    Account Balances for {account}
                </Typography>
                {loading && <Typography variant="paragraph">Loading...</Typography>}
                {balances && (
                    <div className="relative">
                        <div ref={containerRef} className="overflow-x-auto">
                            <Table className="w-full border-2 border-gray-200">
                                <TableHead>
                                    <TableRow>
                                        <TableColumn>Token</TableColumn>
                                        <TableColumn>Balance</TableColumn>
                                    </TableRow>
                                </TableHead>
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
                <div className="flex mb-3">
                    <Typography variant="h5" color="blue-gray">
                        Transactions
                    </Typography>
                    <div className="ml-auto flex gap-2 sm:gap-3 items-center">
                        <Button variant="outlined" className="px-2 py-2 sm:px-6 sm:py-3 flex flex-col sm:flex-row sm:gap-1" onClick={() => page('prev')}>
                            <span className="min-w-[65px] sm:min-w-0">Previous</span><span>Page</span> 
                        </Button>
                        <Button variant="outlined" className="px-2 py-2 sm:px-6 sm:py-3 flex flex-col sm:flex-row sm:gap-1" onClick={() => page('next')}>
                            <span className="min-w-[65px] sm:min-w-0">Next</span><span>Page</span>
                        </Button>
                    </div>
                </div>
                {isTransactionsLoading && (
                    <div className="flex justify-center">
                        <Spinner />
                    </div>
                )}

                {!isTransactionsLoading && (!transactions || transactions.length === 0) && (
                    <Typography variant="paragraph" color="blue-gray">
                        No transactions found
                    </Typography>
                )}

                {!isTransactionsLoading && transactions && transactions.length > 0 && (
                    <List className="p-0 ">
                        {transactions.map((tx, i) => (
                            <React.Fragment key={tx.id}>
                                <ListItem onClick={listItemClickHandler(() => navigate(`/block-explorer/transaction?id=${tx.id}`))} className="cursor-pointer outer-list-item">
                                    <div>
                                        <div className="mb-2">
                                            <Typography variant="paragraph" color="blue-gray" className="flex md:items-center gap-2 flex-col md:flex-row mb-2 md:mb-0">
                                                <Link to={`/block-explorer/transaction?id=${tx.id}`} className="font-semibold underline text-blue-gray-800 break-all">
                                                    {tx.id}
                                                </Link>{' '}
                                                <span className="hidden md:block">|{' '}</span>
                                                <Link to={`/block-explorer/block?block=${tx.block_num}`} className="font-semibold underline text-blue-gray-800">
                                                    Block {tx.block_num}
                                                </Link>
                                                {tx.id.includes('_') && <Chip variant="outlined" value="virtual" className="ml-2 rounded-full inline italic" />}
                                            </Typography>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2 w-full">
                                            <TxTypeChip type={tx.type} className="order-1" />
                                            <AccountChip account={tx.player} className="order-4 sm:order-2" />
                                            <TxStatusChip success={tx.success ?? false} error={tx.error} className="order-2 sm:order-3" />
                                            <div className="basis-full h-0 sm:hidden order-3"></div>
                                        </div>
                                    </div>
                                </ListItem>
                                {i !== transactions.length - 1 && <hr className="my-0 opacity-75 border-blue-gray-200" />}
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
            <AccountInfo className="2xl:w-3/4 w-full" account={account} />
            <AccountBalances className="2xl:w-3/4 w-full" account={account} />
            <TransactionList className="2xl:w-3/4 w-full" account={account} />
        </div>
    );
}
