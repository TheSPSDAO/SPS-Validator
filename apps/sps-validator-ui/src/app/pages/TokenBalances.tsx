import { Card, CardBody, Checkbox, Spinner, Tab, TabPanel, Tabs, TabsBody, TabsHeader, Typography } from '@material-tailwind/react';
import { useState } from 'react';
import { DefaultService } from '../services/openapi';
import { usePromise } from '../hooks/Promise';
import { Table, TableBody, TableCell, TableColumn, TableHead, TablePager, TableRow } from '../components/Table';

const tokens = ['SPS', 'SPSP', 'LICENSE'];

function TokenBalancesTab({ token }: { token: string }) {
    const [page, setPage] = useState(0);
    const [limit, setLimit] = useState(10); // TODO: Add a limit selector
    const [systemAccounts, setSystemAccounts] = useState(false);
    const [count, isLoadingCount] = usePromise(() => DefaultService.getBalancesByToken(token, 0, 0, systemAccounts), [token, systemAccounts]);
    const [balances, isLoading] = usePromise(() => DefaultService.getBalancesByToken(token, limit, page * limit, systemAccounts), [token, page, limit, systemAccounts]);

    const toggleSystemAccounts = (value: boolean) => {
        setSystemAccounts(value);
        setPage(0);
    };

    if (isLoading || isLoadingCount) {
        return <Spinner className="w-full" />;
    }

    return (
        <>
            <Table className="w-full">
                <TableHead>
                    <TableRow>
                        <TableColumn>Token</TableColumn>
                        <TableColumn>
                            <div className="flex items-center">
                                Player
                                <div className="ms-5">
                                    <Checkbox checked={systemAccounts} label="Include System Accounts" onChange={(e) => toggleSystemAccounts(e.target.checked)} />
                                </div>
                            </div>
                        </TableColumn>
                        <TableColumn>Balance</TableColumn>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {balances?.balances?.map((balance) => (
                        <TableRow key={balance.player}>
                            <TableCell>{token}</TableCell>
                            <TableCell>{balance.player}</TableCell>
                            <TableCell>{balance.balance}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
            {count?.count && <TablePager className="w-full justify-center mt-3" page={page} limit={limit} displayPageCount={2} onPageChange={setPage} count={count?.count} />}
        </>
    );
}

export function TokenBalances() {
    return (
        <Card>
            <CardBody>
                <Typography variant="h5" color="blue-gray" className="mb-2">
                    Token Balances
                </Typography>
                <Tabs className="mt-4" value={tokens[0]}>
                    <TabsHeader>
                        {tokens.map((token) => (
                            <Tab key={token} value={token}>
                                {token}
                            </Tab>
                        ))}
                    </TabsHeader>
                    <TabsBody>
                        {tokens.map((token) => (
                            <TabPanel key={token} value={token}>
                                <TokenBalancesTab token={token} />
                            </TabPanel>
                        ))}
                    </TabsBody>
                </Tabs>
            </CardBody>
        </Card>
    );
}
