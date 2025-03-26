import { Card, CardBody, Checkbox, Select, Spinner, Tab, TabPanel, Tabs, TabsBody, TabsHeader, Typography, Option } from '@material-tailwind/react';
import { useMemo, useRef, useState } from 'react';
import { DefaultService } from '../services/openapi';
import { usePromise } from '../hooks/Promise';
import { Table, TableBody, TableCell, TableColumn, TableHead, TablePager, TableRow, GradientOverflow, TableHeader } from '../components/Table';
import { localeNumber } from '../components/LocaleNumber';
import { useSpinnerColor } from '../hooks/SpinnerColor'
import { ChevronDownIcon } from '@heroicons/react/24/solid';

const tokens = ['SPS', 'SPSP', 'SPS_TOTAL', 'LICENSE', 'ACTIVATED_LICENSE', 'LICENSE_TOTAL', 'RUNNING_LICENSE'];

function TokenBalancesTable({ token }: { token: string }) {
    const [page, setPage] = useState(0);
    const [limit, setLimit] = useState(10); // TODO: Add a limit selector
    const [systemAccounts, setSystemAccounts] = useState(false);
    const [count, isLoadingCount] = usePromise(() => DefaultService.getBalancesByToken(token, 0, 0, systemAccounts), [token, systemAccounts]);
    const [balances, isLoading] = usePromise(() => DefaultService.getBalancesByToken(token, limit, page * limit, systemAccounts), [token, page, limit, systemAccounts]);
    const spinnerColor = useSpinnerColor("blue")
    const containerRef = useRef<HTMLDivElement | null>(null);


    const toggleSystemAccounts = (value: boolean) => {
        setSystemAccounts(value);
        setPage(0);
    };


    if (isLoading || isLoadingCount) {
        return <Spinner className="w-full" color={spinnerColor}/>;
    }

    return (
        <div className="relative">
            <div ref={containerRef} className="overflow-x-auto">
                <Table className="w-full border-2 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-300">
                    <TableHead>
                        <TableRow>
                            <TableColumn className="dark:bg-gray-300 dark:text-gray-800">Token</TableColumn>
                            <TableColumn className="dark:bg-gray-300 dark:text-gray-800">
                                <div className="flex items-center">
                                    Player
                                    <div className="ms-5">
                                        <Checkbox checked={systemAccounts} label="Include System Accounts" onChange={(e) => toggleSystemAccounts(e.target.checked)} className="dark:checked:bg-blue-800 dark:border-gray-800 dark:before:bg-blue-400 dark:checked:before:bg-blue-400 dark:text-gray-800" labelProps={{className: "dark:text-gray-800"}}/>
                                    </div>
                                </div>
                            </TableColumn>
                            <TableColumn className="dark:bg-gray-300 dark:text-gray-800">Balance</TableColumn>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {balances?.balances?.map((balance) => (
                            <TableRow key={balance.player} className="dark:border-gray-300">
                                <TableCell>{token}</TableCell>
                                <TableCell>{balance.player}</TableCell>
                                <TableCell>{localeNumber(balance.balance)}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
            <GradientOverflow isLoading={isLoading} containerRef={containerRef} />
            {count?.count && <TablePager className="w-full justify-center mt-3" page={page} limit={limit} displayPageCount={2} onPageChange={setPage} count={count?.count} containerRef={containerRef} />}
        </div>
    );
}

function TokenSupplyTable({ token }: { token: string }) {
    const [supply, isLoading] = usePromise(() => DefaultService.getExtendedTokenSupply(token), [token]);
    const spinnerColor = useSpinnerColor("blue")
    if (isLoading) {
        return <Spinner className="w-full" color={spinnerColor}/>;
    } else if (!supply) {
        return <Typography variant="h6">No supply information available</Typography>;
    } else if (token === 'SPS') {
        return <SpsSupplyTable supply={supply as SpsTokenSupply} />;
    }

    return <ObjectTable obj={supply}></ObjectTable>;
}

function ObjectTable({ obj }: { obj: Record<string, any> }) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const format = (value: any) => {
        if (typeof value === 'object') {
            return JSON.stringify(value);
        } else if (typeof value === 'number') {
            return localeNumber(value);
        }
        return value;
    };
    return (
        <div className="relative">
            <div ref={containerRef} className="overflow-x-auto">
                <Table className="w-full border-2 p-4 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-300">
                    <TableHeader columns={["Property", "Value"]}/>
                    <TableBody>
                        {Object.entries(obj ?? {}).map(([key, value]) => (
                            <TableRow key={key}  className="dark:border-gray-300">
                                <TableCell>{key}</TableCell>
                                <TableCell>{format(value)}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
            <GradientOverflow containerRef={containerRef} isLoading={false} />
        </div>
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
    
    const summary = useMemo(() => {
        return {
            minted: supply.minted,
            burned: supply.burned,
            total_staked: supply.total_staked,
            total_supply: supply.total_supply,
            circulating_supply: supply.circulating_supply,
        };
    }, [supply]);
    return (
        <div className="relative">
            <div className="overflow-x-auto">
                <Tabs value="sum">
                    <TabsHeader  className="flex items-center dark:bg-gray-300 dark:text-gray-800" indicatorProps={{className: "transition-colors delay-200 duration-400 dark:bg-blue-800"}}>
                        <Tab value="sum" activeClassName="dark:text-gray-300 transition-colors delay-200 duration-400" className="transition-colors delay-200 duration-400">Summary</Tab>
                        <Tab value="offChain" activeClassName="dark:text-gray-300 transition-colors delay-200 duration-400" className="transition-colors delay-200 duration-400">Off Chain</Tab>
                        <Tab value="reserve" activeClassName="dark:text-gray-300 transition-colors delay-200 duration-400" className="transition-colors delay-200 duration-400">Reserve</Tab>
                        <Tab value="rewardPools" activeClassName="dark:text-gray-300 transition-colors delay-200 duration-400" className="transition-colors delay-200 duration-400">Reward Pools</Tab>
                    </TabsHeader>
                    <TabsBody>
                        <TabPanel value="sum">
                            <ObjectTable obj={summary}></ObjectTable>
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
            </div>
        </div>
    );
}

export function TokenBalances() {
    const [token, setToken] = useState(tokens[0]);
    return (
        <div className="grid gap-6 w-full">
            <Card className="w-full col-span-full dark:bg-gray-800 dark:text-gray-300 dark:shadow-none">
                <CardBody>
                    <Typography variant="h5" color="blue-gray" className="mb-2 dark:text-gray-200">
                        Token Information
                    </Typography>
                    <div className="mt-4 flex max-w-96 dark:bg-gray-800 dark:text-gray-300">
                        <Select 
                            label="Token" 
                            value={token} 
                            onChange={(val) => setToken(val ?? tokens[0])} 
                            className="dark:bg-gray-800 dark:text-gray-300 dark:border-x-gray-300 dark:border-b-gray-300"
                            labelProps={{className: "dark:text-gray-300 dark:peer-disabled:before:border-transparent dark:peer-disabled:after:border-transparent dark:before:border-gray-300 dark:after:border-gray-300 "}} 
                            containerProps={{className: "dark:bg-gray-800"}} 
                            menuProps={{className: "dark:bg-gray-800 dark:text-gray-300 dark:border-gray-300"}} 
                            arrow={<ChevronDownIcon className="w-5 h-5 dark:fill-gray-300 dark:text-gray-300" />}
                        >
                            {tokens.map((token) => (
                                <Option key={token} value={token} className="dark:text-gray-300 dark:bg-gray-800 dark:hover:bg-gray-300 dark:hover:text-gray-800" >
                                    {token}
                                </Option>
                            ))}
                        </Select>
                    </div>
                </CardBody>
            </Card>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <Card className="w-full col-span-1 dark:bg-gray-800 dark:text-gray-300 dark:shadow-none">
                    <CardBody>
                        <Typography variant="h5" color="blue-gray" className="mb-6 dark:text-gray-200">
                            Account Balances
                        </Typography>
                        <div>
                            <TokenBalancesTable token={token} />
                        </div>
                    </CardBody>
                </Card>
                <Card className="w-full col-span-1 dark:bg-gray-800 dark:text-gray-300 dark:shadow-none">
                    <CardBody>
                        <Typography variant="h5" color="blue-gray" className="mb-6 dark:text-gray-200">
                            Token Supply
                        </Typography>
                        <div>
                            <TokenSupplyTable token={token} />
                        </div>
                    </CardBody>
                </Card>
            </div>
        </div>
    );
}
