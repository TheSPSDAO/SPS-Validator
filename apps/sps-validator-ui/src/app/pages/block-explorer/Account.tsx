import { Button, Card, CardBody, Chip, List, ListItem, Spinner, Typography } from '@material-tailwind/react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { localeNumber } from '../../components/LocaleNumber';
import { Table, TableBody, TableCell, TableColumn, TableHead, TableRow } from '../../components/Table';
import { usePromise } from '../../hooks/Promise';
import { DefaultService, Transaction } from '../../services/openapi';
import React, { useState } from 'react';
import { OmniBox } from './OmniBox';
import { AccountChip, TxStatusChip, TxTypeChip } from './Chips';
import { listItemClickHandler } from './utils';

function AccountInfo({ account, className }: { account: string | null; className?: string }) {
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
                    <div className="overflow-x-auto">
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
                                            <Link to={`/validator-nodes?node=${account}`} target="_blank" className="text-blue-gray-800 underline">
                                                {account}
                                            </Link>
                                        )}
                                    </TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                    </div>
                )}
            </CardBody>
        </Card>
    );
}

function AccountBalances({ account, className }: { account: string | null; className?: string }) {
    const [balances, loading] = usePromise(() => DefaultService.getExtendedBalances(account ?? ''), [account]);
    return (
        <Card className={className}>
            <CardBody>
                <Typography variant="h5" color="blue-gray" className="mb-2">
                    Account Balances for {account}
                </Typography>
                {loading && <Typography variant="paragraph">Loading...</Typography>}
                {balances && (
                    <Table className="w-full mt-4 border-2 border-gray-200">
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
                    <div className="ml-auto flex gap-3 items-center">
                        <Button variant="outlined" onClick={() => page('prev')}>
                            Previous Page
                        </Button>
                        <Button variant="outlined" onClick={() => page('next')}>
                            Next Page
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
                    <List className="p-0">
                        {transactions.map((tx, i) => (
                            <React.Fragment key={tx.id}>
                                <ListItem onClick={listItemClickHandler(() => navigate(`/block-explorer/transaction?id=${tx.id}`))} className="cursor-pointer outer-list-item">
                                    <div>
                                        <div className="mb-2">
                                            <Typography variant="paragraph" color="blue-gray" className="flex items-center gap-2">
                                                <Link to={`/block-explorer/transaction?id=${tx.id}`} className="font-semibold underline text-blue-gray-800">
                                                    {tx.id}
                                                </Link>{' '}
                                                |{' '}
                                                <Link to={`/block-explorer/block?block=${tx.block_num}`} className="font-semibold underline text-blue-gray-800">
                                                    Block {tx.block_num}
                                                </Link>
                                                {tx.id.includes('_') && <Chip variant="outlined" value="virtual" className="ml-2 rounded-full inline italic" />}
                                            </Typography>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <TxTypeChip type={tx.type} />
                                            <AccountChip account={tx.player} />
                                            <TxStatusChip success={tx.success ?? false} error={tx.error} />
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
