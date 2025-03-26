import { Button, Card, CardBody, Chip, List, ListItem, Spinner, Typography } from '@material-tailwind/react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { localeNumber } from '../../components/LocaleNumber';
import { Table, TableBody, TableCell, TableRow } from '../../components/Table';
import { usePromise } from '../../hooks/Promise';
import { DefaultService } from '../../services/openapi';
import React from 'react';
import { OmniBox } from './OmniBox';
import { AccountChip, BlockTimeChip, TxStatusChip, TxTypeChip, ValidatorChip } from './Chips';
import { listItemClickHandler } from './utils';
import { useSpinnerColor } from '../../hooks/SpinnerColor';

function BlockInfo({ block: blockNum, className }: { block: string | null; className?: string }) {
    const navigate = useNavigate();
    const parsedBlockNum = parseInt(blockNum ?? '');
    const spinnerColor = useSpinnerColor("blue");
    const [block, isBlocksLoading] = usePromise(async () => {
        try {
            return !isNaN(parsedBlockNum) ? await DefaultService.getBlock(parsedBlockNum) : undefined;
        } catch (e) {
            // api returns a 404 for non-existent blocks so we just catch the exception
            return undefined;
        }
    }, [blockNum]);
    return (
        <Card className={className}>
            <CardBody>
                <div className="flex mb-3">
                    <Typography variant="h5" color="blue-gray" className="dark:text-gray-200">
                        Block {localeNumber(parsedBlockNum, 0)}
                    </Typography>
                    <div className="ml-auto flex gap-3 items-center">
                        <Button variant="outlined" className="p-2 sm:px-6 sm:py-3 flex flex-col sm:flex-row sm:gap-1 dark:bg-blue-800 dark:hover:bg-blue-600 dark:border-gray-300 dark:border dark:text-gray-300 dark:hover:text-gray-100 dark:shadow-none" onClick={() => navigate(`/block-explorer/block?block=${parsedBlockNum - 1}`)}>
                            <span className="min-w-[65px] sm:min-w-0">Previous</span><span>Block</span>
                        </Button>
                        <Button variant="outlined" className="p-2 sm:px-6 sm:py-3 flex flex-col sm:flex-row sm:gap-1 dark:bg-blue-800 dark:hover:bg-blue-600 dark:border-gray-300 dark:border dark:text-gray-300 dark:hover:text-gray-100 dark:shadow-none" onClick={() => navigate(`/block-explorer/block?block=${parsedBlockNum + 1}`)}>
                            <span className="min-w-[65px] sm:min-w-0">Next</span><span>Block</span>
                        </Button>
                    </div>
                </div>

                {isBlocksLoading && (
                    <div className="flex justify-center">
                        <Spinner color={spinnerColor} />
                    </div>
                )}

                {!isBlocksLoading && !block && (
                    <Typography variant="paragraph" color="blue-gray" className="dark:text-gray-300">
                        Block not found
                    </Typography>
                )}

                {!isBlocksLoading && block && (
                    <div className="">
                        <Table className="w-full">
                            <TableBody>
                                <TableRow>
                                    <TableCell className="font-bold dark:border-gray-300">Hive Block ID</TableCell>
                                    <TableCell className="break-all dark:border-gray-300">
                                        <Link to={`https://hivehub.dev/b/${blockNum}`} target="_blank" rel="noopener noreferrer" className="text-blue-gray-800 underline dark:text-gray-400">
                                            {block.block_id}
                                        </Link>
                                    </TableCell>
                                </TableRow>
                                <TableRow>
                                    <TableCell className="font-bold break-words dark:border-gray-300">L2 Block ID</TableCell>
                                    <TableCell className="break-all dark:border-gray-300">{block.l2_block_id}</TableCell>
                                </TableRow>
                                <TableRow>
                                    <TableCell className="font-bold dark:border-gray-300">Date</TableCell>
                                    <TableCell className="flex dark:border-gray-300">
                                        <BlockTimeChip blockTime={block.block_time} className="dark:text-gray-800 dark:bg-gray-300 " />
                                    </TableCell>
                                </TableRow>
                                <TableRow>
                                    <TableCell className="font-bold dark:border-gray-300">Validator</TableCell>
                                    <TableCell className="flex dark:border-gray-300">
                                        <ValidatorChip account={block.validator} validation_tx={block.validation_tx} className="dark:text-gray-300 dark:border-gray-300" />
                                    </TableCell>
                                </TableRow>
                                <TableRow>
                                    <TableCell className="font-bold dark:border-gray-300">Validation tx</TableCell>
                                    <TableCell className="break-all dark:border-gray-300">
                                        {!block.validation_tx && 'none'}
                                        {block.validation_tx && (
                                            <Link to={`/block-explorer/transaction?id=${block.validation_tx}`} className="text-blue-gray-800 underline dark:text-gray-400">
                                                {block.validation_tx}
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

function TransactionList({ block: blockNum, className }: { block: string | null; className?: string }) {
    const nav = useNavigate();
    const spinnerColor = useSpinnerColor("blue");
    const [transactions, isTransactionsLoading] = usePromise(async () => {
        try {
            const parsedBlockNum = parseInt(blockNum ?? '');
            if (isNaN(parsedBlockNum)) {
                return [];
            }
            return await DefaultService.getTransactions(parsedBlockNum);
        } catch (e) {
            return [];
        }
    }, [blockNum]);

    return (
        <Card className={className}>
            <CardBody>
                <Typography variant="h5" color="blue-gray" className="mb-3 dark:text-gray-200">
                    Transactions {transactions && transactions.length > 0 && '(' + transactions.length + ' transaction' + (transactions.length > 1 ? 's' : '') + ')'}
                </Typography>
                {isTransactionsLoading && (
                    <div className="flex justify-center">
                        <Spinner color={spinnerColor} />
                    </div>
                )}

                {!isTransactionsLoading && (!transactions || transactions.length === 0) && (
                    <Typography variant="paragraph" color="blue-gray" className="dark:text-gray-300">
                        No transactions found
                    </Typography>
                )}

                {!isTransactionsLoading && transactions && transactions.length > 0 && (
                    <List className="p-0">
                        {transactions.map((tx, i) => (
                            <React.Fragment key={tx.id}>
                                <ListItem onClick={listItemClickHandler(() => nav(`/block-explorer/transaction?id=${tx.id}`))} className="cursor-pointer outer-list-item  group dark:hover:bg-gray-300 dark:focus:bg-gray-300">
                                    <div className="pointer-events-none">
                                        <div className="mb-2">
                                            <Typography variant="paragraph" color="blue-gray" className="flex items-center break-all">
                                                <Link to={`/block-explorer/transaction?id=${tx.id}`} className="pointer-events-auto font-semibold underline text-blue-gray-800 dark:text-gray-400 dark:group-hover:text-gray-900 dark:group-focus:text-gray-900">
                                                    {tx.id}
                                                </Link>
                                                {tx.id.includes('_') && <Chip variant="outlined" value="virtual" className="ml-2 rounded-full inline italic dark:text-gray-300 dark:border-gray-300 dark:group-hover:text-gray-800 dark:group-hover:border-gray-800 dark:group-focus:text-gray-800 dark:group-focus:border-gray-800" />}
                                            </Typography>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2 w-full">
                                            <TxTypeChip type={tx.type} className="order-1 pointer-events-auto dark:text-gray-800 dark:bg-gray-300 dark:group-hover:bg-gray-800 dark:group-hover:text-gray-300 dark:group-focus:bg-gray-800 dark:group-focus:text-gray-300" />
                                            <AccountChip account={tx.player} className="order-4 sm:order-2 pointer-events-auto dark:text-gray-300 dark:border-gray-300 dark:group-hover:text-gray-800 dark:group-hover:border-gray-800 dark:group-focus:text-gray-800 dark:group-focus:border-gray-800" />
                                            <TxStatusChip success={tx.success ?? false} error={tx.error} className="order-2 sm:order-3 pointer-events-auto dark:text-gray-200" />
                                            <div className="basis-full h-0 sm:hidden order-3"></div>
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

export function Block() {
    const [searchParams] = useSearchParams({ block: '0' });
    const blockNum = searchParams.get('block');
    //
    return (
        <div className="grid grid-cols-1 place-items-center gap-4">
            <OmniBox className="2xl:w-3/4 w-full" />
            <BlockInfo className="2xl:w-3/4 w-full dark:bg-gray-800 dark:text-gray-300" block={blockNum} />
            <TransactionList className="2xl:w-3/4 w-full dark:bg-gray-800 dark:text-gray-300" block={blockNum} />
        </div>
    );
}
