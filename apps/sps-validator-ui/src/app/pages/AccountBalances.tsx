import { useSearchParams } from 'react-router-dom';
import { Hive } from '../services/hive';
import { Button, Card, CardBody, Input, Typography } from '@material-tailwind/react';
import { FormEvent, useState } from 'react';
import { usePromise } from '../hooks/Promise';
import { DefaultService } from '../services/openapi';
import { Table, TableBody, TableCell, TableColumn, TableHead, TableRow } from '../components/Table';

export function AccountBalancesCard({ account }: { account: string }) {
    const [balances, loading] = usePromise(() => DefaultService.getBalances(account), [account]);
    return (
        <Card>
            <CardBody>
                <Typography variant="h5" color="blue-gray" className="mb-2">
                    Account Balances for {account}
                </Typography>
                {loading && <Typography variant="paragraph">Loading...</Typography>}
                {balances && (
                    <Table className="w-full mt-4">
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
                                    <TableCell>{balance.balance.toLocaleString()}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
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
            <Card>
                <CardBody>
                    <Typography variant="h5" color="blue-gray" className="mb-2">
                        Account Balances
                    </Typography>
                    <Typography variant="paragraph">Enter an account to look up their account balances.</Typography>

                    <form className="mt-4 flex gap-4 2xl:max-w-96 2xl:w-1/4 lg:w-2/3 md:w-full" onSubmit={setAccountInParams}>
                        <Input value={account} onChange={(e) => setAccount(e.target.value)} label="Account" placeholder="Account" className="flex-grow-1" />
                        <Button className="w-32" type="submit">
                            Search
                        </Button>
                    </form>
                </CardBody>
            </Card>
            {searchAccount && <AccountBalancesCard account={searchAccount} />}
        </div>
    );
}
