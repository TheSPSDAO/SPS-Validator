import { useSearchParams } from 'react-router-dom';
import { Hive } from '../services/hive';
import { Button, Card, CardBody, Input, Typography } from '@material-tailwind/react';
import { FormEvent, useRef, useState } from 'react';
import { usePromise } from '../hooks/Promise';
import { DefaultService } from '../services/openapi';
import { Table, TableBody, TableCell, TableRow, TableHeader, GradientOverflow } from '../components/Table';
import { localeNumber } from '../components/LocaleNumber';
import { MagnifyingGlassIcon } from '@heroicons/react/24/solid';

export function AccountBalancesCard({ account }: { account: string }) {
    const [balances, loading] = usePromise(() => DefaultService.getBalances(account), [account]);
    const containerRef = useRef<HTMLDivElement | null>(null);
    return (
        <Card className="dark:bg-gray-800 dark:text-gray-300 dark:shadow-none">
            <CardBody>
                <Typography variant="h5" color="blue-gray" className="mb-6 dark:text-gray-200">
                    Account Balances for {account}
                </Typography>
                {loading && <Typography variant="paragraph"  className="dark:text-gray-300">Loading...</Typography>}
                {balances && (
                    <div className="relative">
                        <div ref={containerRef} className="overflow-x-auto">
                            <Table className="w-full border-2 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-300">
                                <TableHeader columns={["Token", "Balance"]} />
                                <TableBody>
                                    {balances.map((balance) => (
                                        <TableRow key={balance.token} className="dark:border-gray-300">
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

export function AccountBalances() {
    const [searchParams, setSearchParams] = useSearchParams({
        account: Hive.ACCOUNT ?? '',
    });
    const searchAccount = searchParams.get('account') ?? '';

    const [account, setAccount] = useState<string>(searchAccount);
    const setAccountInParams = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setSearchParams({ account });
    };

    return (
        <div className="flex flex-col gap-4">
            <Card className="dark:bg-gray-800 dark:text-gray-300 dark:shadow-none">
                <CardBody>
                    <Typography variant="h5" color="blue-gray" className="mb-2 dark:text-gray-200">
                        Account Balances
                    </Typography>
                    <Typography variant="paragraph" className="dark:text-gray-300">Enter an account to look up their account balances.</Typography>

                    <form className="mt-4 flex gap-4 w-full sm:max-w-[400px]" onSubmit={setAccountInParams}>
                        <Input 
                            value={account} 
                            onChange={(e) => setAccount(e.target.value)} 
                            label="Account" 
                            placeholder="Account" 
                            className="flex-grow-1 dark:text-gray-300 dark:border-gray-300 dark:placeholder-shown:border-t-gray-300 dark:focus:border-gray-200 dark:focus:border-t-transparent dark:placeholder:text-gray-300 dark:focus:placeholder:text-gray-500 dark:border-t-transparent" 
                            labelProps={{className: "dark:peer-placeholder-shown:text-gray-300 dark:placeholder:text-gray-300 dark:text-gray-300 dark:peer-focus:text-gray-300 dark:peer-focus:before:!border-gray-200 dark:peer-focus:after:!border-gray-200 dark:before:border-gray-300 dark:after:border-gray-300"}}
                        />
                        <Button className="p-2 sm:w-32 dark:bg-blue-800 dark:hover:bg-blue-600 dark:border-gray-300 dark:border dark:text-gray-300 dark:hover:text-gray-100 dark:shadow-none" type="submit">
                            <MagnifyingGlassIcon className="sm:hidden h-6 w-6"/>
                            <p className="sr-only sm:not-sr-only">Lookup</p>
                        </Button>
                    </form>
                </CardBody>
            </Card>
            {searchAccount && <AccountBalancesCard account={searchAccount} />}
        </div>
    );
}
