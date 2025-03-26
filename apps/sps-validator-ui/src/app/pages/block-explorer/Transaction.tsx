import { Card, CardBody, Typography, Spinner, Chip } from '@material-tailwind/react';
import { Link, useSearchParams } from 'react-router-dom';
import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import json from 'react-syntax-highlighter/dist/esm/languages/prism/json';
import { TableBody, TableRow, TableCell, Table, GradientOverflow } from '../../components/Table';
import { usePromise } from '../../hooks/Promise';
import { DefaultService } from '../../services/openapi';
import { OmniBox } from './OmniBox';
import { AccountChip, BlockTimeChip, TxStatusChip, TxTypeChip } from './Chips';
import { useMemo, useRef } from 'react';
import { InfoTooltip } from '../../components/InfoTooltip';
import { useSpinnerColor } from '../../hooks/SpinnerColor';
import { useDarkMode } from '../../context/DarkModeContext';

SyntaxHighlighter.registerLanguage('json', json);

function TransactionInfo({ id: trxId, className }: { id: string | null; className?: string }) {
    const spinnerColor = useSpinnerColor("blue");
    const { darkMode } = useDarkMode();
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
                        <Typography variant="h5" color="blue-gray" className="leading-none break-all dark:text-gray-200">
                            Transaction {trxId}
                        </Typography>
                        {transaction?.id.includes('_') && <Chip variant="outlined" value="virtual" className="ml-2 rounded-full inline italic dark:text-gray-300 dark:border-gray-300 dark:group-hover:text-gray-800 dark:group-hover:border-gray-800" />}
                    </div>

                    {isTrxLoading && (
                        <div className="flex justify-center">
                            <Spinner color={spinnerColor} />
                        </div>
                    )}

                    {!isTrxLoading && !transaction && (
                        <Typography variant="paragraph" color="blue-gray" className="dark:text-gray-300">
                            Transaction not found
                        </Typography>
                    )}

                    {!isTrxLoading && transaction && (
                        <div className="relative">
                            <div ref={containerRef} className="overflow-x-auto">
                                <Table className="w-full">
                                    <TableBody>
                                        <TableRow>
                                            <TableCell className="font-bold dark:border-gray-300">Transaction ID</TableCell>
                                            <TableCell className="dark:border-gray-300">
                                                <Link
                                                    to={`https://hivehub.dev/tx/${transaction.id}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-blue-gray-800 underline break-all dark:text-gray-400"
                                                >
                                                    {transaction.id}
                                                </Link>
                                            </TableCell>
                                        </TableRow>
                                        <TableRow>
                                            <TableCell className="font-bold dark:border-gray-300">Block Num</TableCell>
                                            <TableCell className="dark:border-gray-300">
                                                <Link to={`/block-explorer/block?block=${transaction.block_num}`} className="text-blue-gray-800 underline dark:text-gray-400">
                                                    {transaction.block_num}
                                                </Link>
                                            </TableCell>
                                        </TableRow>
                                        <TableRow>
                                            <TableCell className="font-bold dark:border-gray-300">Account</TableCell>
                                            <TableCell className="flex dark:border-gray-300">
                                                <AccountChip account={transaction.player} className="dark:text-gray-300 dark:border-gray-300" />
                                            </TableCell>
                                        </TableRow>
                                        <TableRow>
                                            <TableCell className="font-bold dark:border-gray-300">Type</TableCell>
                                            <TableCell className="flex dark:border-gray-300">
                                                <TxTypeChip type={transaction.type} className="dark:text-gray-800 dark:bg-gray-300" />
                                            </TableCell>
                                        </TableRow>
                                        <TableRow>
                                            <TableCell className="font-bold dark:border-gray-300">Date</TableCell>
                                            <TableCell className="flex dark:border-gray-300">
                                                <BlockTimeChip blockTime={transaction.created_date} className="dark:text-gray-800 dark:bg-gray-300" />
                                            </TableCell>
                                        </TableRow>
                                        <TableRow>
                                            <TableCell className="font-bold dark:border-gray-300">Status</TableCell>
                                            <TableCell className="flex dark:border-gray-300">
                                                <TxStatusChip success={transaction.success ?? false} error={transaction.error} />
                                            </TableCell>
                                        </TableRow>
                                    </TableBody>
                                </Table>
                            </div>
                            <GradientOverflow isLoading={isTrxLoading} containerRef={containerRef}/>
                        </div>
                    )}
                </CardBody>
            </Card>
            <Card className={className}>
                <CardBody>
                    <Typography variant="h5" color="blue-gray" className="flex items-center gap-2 dark:text-gray-200">
                        Transaction Parameters
                        <InfoTooltip text="The custom_json parameters for this transaction." className="dark:text-gray-200" />
                    </Typography>
                    <SyntaxHighlighter language="json" style={oneLight} wrapLongLines={true} wrapLines={true} customStyle={{ backgroundColor: darkMode ? '#e0e0e0' : '#fafafa' }} codeTagProps={{ style: { backgroundColor: darkMode ? '#e0e0e0' : '#fafafa' } }} >
                        {prettyData}
                    </SyntaxHighlighter>
                </CardBody>
            </Card>
            {transaction?.success && (
                <Card className={className}>
                    <CardBody>
                        <Typography variant="h5" color="blue-gray" className="flex items-center gap-2 dark:text-gray-200">
                            Transaction Result
                            <InfoTooltip text="The transaction result is a JSON object that records every database change that was made by the transaction. These changes are hashed into the block hash, which is used to make sure all of the validators agree on the state of the database." className="dark:text-gray-200" />
                        </Typography>
                            <SyntaxHighlighter language="json" style={oneLight} wrapLongLines={true}  wrapLines={true} customStyle={{ backgroundColor: darkMode ? '#e0e0e0' : '#fafafa' }} codeTagProps={{ style: { backgroundColor: darkMode ? '#e0e0e0' : '#fafafa' } }} >
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
            <TransactionInfo className="2xl:w-3/4 w-full dark:bg-gray-800 dark:text-gray-300" id={id} />
        </div>
    );
}
