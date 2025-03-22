import { Card, CardBody, Typography, Spinner, Chip } from '@material-tailwind/react';
import { Link, useSearchParams } from 'react-router-dom';
import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import json from 'react-syntax-highlighter/dist/esm/languages/prism/json';
import { TableBody, TableRow, TableCell, Table } from '../../components/Table';
import { usePromise } from '../../hooks/Promise';
import { DefaultService } from '../../services/openapi';
import { OmniBox } from './OmniBox';
import { AccountChip, BlockTimeChip, TxStatusChip, TxTypeChip } from './Chips';
import { useMemo, useRef } from 'react';
import { InfoTooltip } from '../../components/InfoTooltip';

SyntaxHighlighter.registerLanguage('json', json);

function TransactionInfo({ id: trxId, className }: { id: string | null; className?: string }) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const [transaction, isTrxLoading] = usePromise(async () => {
        if (!trxId) {
            return undefined;
        }

        try {
            return await DefaultService.getTransaction(trxId);
        } catch (e) {
            // api returns a 404 for non-existent blocks so we just catch the exception
            return undefined;
        }
    }, [trxId]);

    const prettyData = useMemo(() => {
        if (!transaction?.data) {
            return '';
        }
        try {
            return JSON.stringify(JSON.parse(transaction.data), null, 2);
        } catch (e) {
            return transaction.data;
        }
    }, [transaction?.data]);
    const prettyResult = useMemo(() => {
        if (!transaction?.result) {
            return '';
        }
        try {
            return JSON.stringify(JSON.parse(transaction.result), null, 2);
        } catch (e) {
            return transaction.result;
        }
    }, [transaction?.result]);

    return (
        <>
            <Card className={className}>
                <CardBody>
                    <div className="flex flex-col sm:flex-row items-center mb-3">
                        <Typography variant="h5" color="blue-gray" className="break-all">
                            Transaction {trxId}
                        </Typography>
                        {transaction?.id.includes('_') && <Chip variant="outlined" value="virtual" className="ml-2 rounded-full inline italic" />}
                    </div>

                    {isTrxLoading && (
                        <div className="flex justify-center">
                            <Spinner />
                        </div>
                    )}

                    {!isTrxLoading && !transaction && (
                        <Typography variant="paragraph" color="blue-gray">
                            Transaction not found
                        </Typography>
                    )}

                    {!isTrxLoading && transaction && (
                        <div >
                            <Table className="w-full">
                                <TableBody>
                                    <TableRow>
                                        <TableCell className="font-bold">Transaction ID</TableCell>
                                        <TableCell>
                                            <Link
                                                to={`https://hivehub.dev/tx/${transaction.id}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-blue-gray-800 underline break-all"
                                            >
                                                {transaction.id}
                                            </Link>
                                        </TableCell>
                                    </TableRow>
                                    <TableRow>
                                        <TableCell className="font-bold">Block Num</TableCell>
                                        <TableCell>
                                            <Link to={`/block-explorer/block?block=${transaction.block_num}`} className="text-blue-gray-800 underline">
                                                {transaction.block_num}
                                            </Link>
                                        </TableCell>
                                    </TableRow>
                                    <TableRow>
                                        <TableCell className="font-bold">Account</TableCell>
                                        <TableCell className="flex">
                                            <AccountChip account={transaction.player} />
                                        </TableCell>
                                    </TableRow>
                                    <TableRow>
                                        <TableCell className="font-bold">Type</TableCell>
                                        <TableCell className="flex">
                                            <TxTypeChip type={transaction.type} />
                                        </TableCell>
                                    </TableRow>
                                    <TableRow>
                                        <TableCell className="font-bold">Date</TableCell>
                                        <TableCell className="flex">
                                            <BlockTimeChip blockTime={transaction.created_date} />
                                        </TableCell>
                                    </TableRow>
                                    <TableRow>
                                        <TableCell className="font-bold">Status</TableCell>
                                        <TableCell className="flex">
                                            <TxStatusChip success={transaction.success ?? false} error={transaction.error} />
                                        </TableCell>
                                    </TableRow>
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardBody>
            </Card>
            <Card className={className}>
                <CardBody>
                    <Typography variant="h5" color="blue-gray" className="flex items-center gap-2">
                        Transaction Parameters
                        <InfoTooltip text="The custom_json parameters for this transaction." />
                    </Typography>
                    <SyntaxHighlighter language="json" style={oneLight} wrapLongLines={true}>
                        {prettyData}
                    </SyntaxHighlighter>
                </CardBody>
            </Card>
            {transaction?.success && (
                <Card className={className}>
                    <CardBody>
                        <Typography variant="h5" color="blue-gray" className="flex items-center gap-2">
                            Transaction Result
                            <InfoTooltip text="The transaction result is a JSON object that records every database change that was made by the transaction. These changes are hashed into the block hash, which is used to make sure all of the validators agree on the state of the database." />
                        </Typography>
                            <SyntaxHighlighter language="json" style={oneLight} wrapLongLines={true}>
                                {prettyResult}
                            </SyntaxHighlighter>
                    </CardBody>
                </Card>
            )}
        </>
    );
}

export function Transaction() {
    const [searchParams] = useSearchParams({ id: '' });
    const id = searchParams.get('id');
    return (
        <div className="grid grid-cols-1 place-items-center gap-4">
            <OmniBox className="2xl:w-3/4 w-full" />
            <TransactionInfo className="2xl:w-3/4 w-full" id={id} />
        </div>
    );
}
