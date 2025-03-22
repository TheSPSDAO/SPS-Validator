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

function BlockInfo({ block: blockNum, className }: { block: string | null; className?: string }) {
    const navigate = useNavigate();
    const parsedBlockNum = parseInt(blockNum ?? '');
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
                    <Typography variant="h5" color="blue-gray">
                        Block {localeNumber(parsedBlockNum, 0)}
                    </Typography>
                    <div className="ml-auto flex gap-3 items-center">
                        <Button variant="outlined" className="p-2 sm:px-6 sm:py-3 flex flex-col sm:flex-row sm:gap-1" onClick={() => navigate(`/block-explorer/block?block=${parsedBlockNum - 1}`)}>
                            <span className="min-w-[65px] sm:min-w-0">Previous</span><span>Block</span>
                        </Button>
                        <Button variant="outlined" className="p-2 sm:px-6 sm:py-3 flex flex-col sm:flex-row sm:gap-1" onClick={() => navigate(`/block-explorer/block?block=${parsedBlockNum + 1}`)}>
                            <span className="min-w-[65px] sm:min-w-0">Next</span><span>Block</span>
                        </Button>
                    </div>
                </div>

                {isBlocksLoading && (
                    <div className="flex justify-center">
                        <Spinner />
                    </div>
                )}

                {!isBlocksLoading && !block && (
                    <Typography variant="paragraph" color="blue-gray">
                        Block not found
                    </Typography>
                )}

                {!isBlocksLoading && block && (
                    <div className="">
                        <Table className="w-full">
                            <TableBody>
                                <TableRow>
                                    <TableCell className="font-bold">Hive Block ID</TableCell>
                                    <TableCell className="break-all">
                                        <Link to={`https://hivehub.dev/b/${blockNum}`} target="_blank" rel="noopener noreferrer" className="text-blue-gray-800 underline">
                                            {block.block_id}
                                        </Link>
                                    </TableCell>
                                </TableRow>
                                <TableRow>
                                    <TableCell className="font-bold break-words">L2 Block ID</TableCell>
                                    <TableCell className="break-all">{block.l2_block_id}</TableCell>
                                </TableRow>
                                <TableRow>
                                    <TableCell className="font-bold">Date</TableCell>
                                    <TableCell className="flex">
                                        <BlockTimeChip blockTime={block.block_time} />
                                    </TableCell>
                                </TableRow>
                                <TableRow>
                                    <TableCell className="font-bold">Validator</TableCell>
                                    <TableCell className="flex">
                                        <ValidatorChip account={block.validator} validation_tx={block.validation_tx} />
                                    </TableCell>
                                </TableRow>
                                <TableRow>
                                    <TableCell className="font-bold">Validation tx</TableCell>
                                    <TableCell className="break-all">
                                        {!block.validation_tx && 'none'}
                                        {block.validation_tx && (
                                            <Link to={`/block-explorer/transaction?id=${block.validation_tx}`} className="text-blue-gray-800 underline">
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
                <Typography variant="h5" color="blue-gray" className="mb-3">
                    Transactions {transactions && transactions.length > 0 && '(' + transactions.length + ' transaction' + (transactions.length > 1 ? 's' : '') + ')'}
                </Typography>
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
                                <ListItem onClick={listItemClickHandler(() => nav(`/block-explorer/transaction?id=${tx.id}`))} className="cursor-pointer outer-list-item">
                                    <div>
                                        <div className="mb-2">
                                            <Typography variant="paragraph" color="blue-gray" className="flex items-center break-all">
                                                <Link to={`/block-explorer/transaction?id=${tx.id}`} className="font-semibold underline text-blue-gray-800">
                                                    {tx.id}
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

export function Block() {
    const [searchParams] = useSearchParams({ block: '0' });
    const blockNum = searchParams.get('block');
    //
    return (
        <div className="grid grid-cols-1 place-items-center gap-4">
            <OmniBox className="2xl:w-3/4 w-full" />
            <BlockInfo className="2xl:w-3/4 w-full" block={blockNum} />
            <TransactionList className="2xl:w-3/4 w-full" block={blockNum} />
        </div>
    );
}
