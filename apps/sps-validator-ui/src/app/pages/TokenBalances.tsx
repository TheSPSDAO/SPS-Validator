import { Card, CardBody, Checkbox, Select, Spinner, Tab, TabPanel, Tabs, TabsBody, TabsHeader, Typography, Option } from '@material-tailwind/react';
import { useMemo, useState } from 'react';
import { DefaultService } from '../services/openapi';
import { usePromise } from '../hooks/Promise';
import { Table, TableBody, TableCell, TableColumn, TableHead, TablePager, TableRow } from '../components/Table';
import { localeNumber } from '../components/LocaleNumber';

const tokens = ['SPS', 'SPSP', 'SPS_TOTAL', 'LICENSE', 'ACTIVATED_LICENSE', 'LICENSE_TOTAL', 'RUNNING_LICENSE'];

function TokenBalancesTable({ token }: { token: string }) {
    const [page, setPage] = useState(0);
    const [limit, setLimit] = useState(10); // TODO: Add a limit selector
    const [systemAccounts, setSystemAccounts] = useState(false);
    const [count, isLoadingCount] = usePromise(() => DefaultService.getExtendedBalancesByToken(token, 0, 0, systemAccounts), [token, systemAccounts]);
    const [balances, isLoading] = usePromise(() => DefaultService.getExtendedBalancesByToken(token, limit, page * limit, systemAccounts), [token, page, limit, systemAccounts]);

    const toggleSystemAccounts = (value: boolean) => {
        setSystemAccounts(value);
        setPage(0);
    };

    if (isLoading || isLoadingCount) {
        return <Spinner className="w-full" />;
    }

    return (
        <>
            <Table className="w-full border-2 border-gray-200">
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
                            <TableCell>{localeNumber(balance.balance)}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
            {count?.count && <TablePager className="w-full justify-center mt-3" page={page} limit={limit} displayPageCount={2} onPageChange={setPage} count={count?.count} />}
        </>
    );
}

function ObjectTable({ obj }: { obj: Record<string, any> }) {
    const format = (value: any) => {
        if (typeof value === 'object') {
            return JSON.stringify(value);
        } else if (typeof value === 'number') {
            return localeNumber(value);
        }
        return value;
    };
    return (
        <Table className="w-full border-2 border-gray-200">
            <TableHead>
                <TableRow>
                    <TableColumn>Property</TableColumn>
                    <TableColumn>Value</TableColumn>
                </TableRow>
            </TableHead>
            <TableBody>
                {Object.entries(obj ?? {}).map(([key, value]) => (
                    <TableRow key={key}>
                        <TableCell>{key}</TableCell>
                        <TableCell>{format(value)}</TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    );
}

type SpsTokenSupply = {
    token: string;
    minted: number;
    burned: number;
    total_staked: number;
    total_supply: number;
    circulating_supply: number;
    off_chain: {
        hive_engine: number;
        eth: number;
        bsc: number;
    };
    reserve: {
        dao: number;
        dao_reserve: number;
        terablock_bsc: number;
        terablock_eth: number;
    };
    reward_pools: {
        total: number;
        [account: string]: number;
    };
};
function SpsSupplyTable({ supply }: { supply: SpsTokenSupply }) {
    const onChain = useMemo(() => {
        return {
            minted: supply.minted,
            burned: supply.burned,
            total_staked: supply.total_staked,
            total_supply: supply.total_supply,
            circulating_supply: supply.circulating_supply,
        };
    }, [supply]);
    return (
        <Tabs value="onChain">
            <TabsHeader>
                <Tab value="onChain">On Chain</Tab>
                <Tab value="offChain">Off Chain</Tab>
                <Tab value="reserve">Reserve</Tab>
                <Tab value="rewardPools">Reward Pools</Tab>
            </TabsHeader>
            <TabsBody>
                <TabPanel value="onChain">
                    <ObjectTable obj={onChain}></ObjectTable>
                </TabPanel>
                <TabPanel value="offChain">
                    <ObjectTable obj={supply.off_chain}></ObjectTable>
                </TabPanel>
                <TabPanel value="reserve">
                    <ObjectTable obj={supply.reserve}></ObjectTable>
                </TabPanel>
                <TabPanel value="rewardPools">
                    <ObjectTable obj={supply.reward_pools}></ObjectTable>
                </TabPanel>
            </TabsBody>
        </Tabs>
    );
}

function TokenSupplyTable({ token }: { token: string }) {
    const [supply, isLoading] = usePromise(() => DefaultService.getExtendedTokenSupply(token), [token]);
    if (isLoading) {
        return <Spinner className="w-full" />;
    } else if (!supply) {
        return <Typography variant="h6">No supply information available</Typography>;
    } else if (token === 'SPS') {
        return <SpsSupplyTable supply={supply as SpsTokenSupply} />;
    }

    return <ObjectTable obj={supply}></ObjectTable>;
}

export function TokenBalances() {
    const [token, setToken] = useState(tokens[0]);
    return (
        <div className="grid gap-6">
            <Card className="col-span-full">
                <CardBody>
                    <Typography variant="h5" color="blue-gray" className="mb-2">
                        Token Information
                    </Typography>
                    <div className="mt-4 flex 2xl:max-w-96 2xl:w-1/4 lg:w-2/3 md:w-full">
                        <Select label="Token" value={token} onChange={(val) => setToken(val ?? tokens[0])}>
                            {tokens.map((token) => (
                                <Option key={token} value={token}>
                                    {token}
                                </Option>
                            ))}
                        </Select>
                    </div>
                </CardBody>
            </Card>
            <div className="grid xl:grid-cols-2 gap-6 col-span-full">
                <Card className="col-span-1">
                    <CardBody>
                        <Typography variant="h5" color="blue-gray" className="mb-2">
                            Account Balances
                        </Typography>
                        <div className="mt-4">
                            <TokenBalancesTable token={token} />
                        </div>
                    </CardBody>
                </Card>
                <Card className="col-span-1">
                    <CardBody>
                        <Typography variant="h5" color="blue-gray" className="mb-2">
                            Token Supply
                        </Typography>
                        <div className="mt-4">
                            <TokenSupplyTable token={token} />
                        </div>
                    </CardBody>
                </Card>
            </div>
        </div>
    );
}
