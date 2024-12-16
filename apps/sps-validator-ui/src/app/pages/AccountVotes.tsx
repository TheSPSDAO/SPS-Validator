import { FormEvent, useState } from 'react';
import { Hive } from '../services/hive';
import { usePromise } from '../hooks/Promise';
import { DefaultService } from '../services/openapi';
import { Button, Card, CardBody, Input, Spinner, Typography } from '@material-tailwind/react';
import { TableHead, TableRow, TableColumn, TableBody, TableCell, Table } from '../components/Table';
import { useSearchParams } from 'react-router-dom';

function AccountVotesCard({ account }: { account: string }) {
    const [votes, isLoading] = usePromise(() => DefaultService.getVotesByAccount(account), [account]);

    if (isLoading) {
        return <Spinner className="w-full" />;
    }

    const noVotes = !votes || votes.length === 0;
    return (
        <Card>
            <CardBody>
                <Typography variant="h5" color="blue-gray" className="mb-2">
                    Votes by {account}
                </Typography>
                <Table className="w-full mt-4">
                    <TableHead>
                        <TableRow>
                            <TableColumn>
                                <Typography color="blue-gray" className="font-normal text-left">
                                    Validator
                                </Typography>
                            </TableColumn>
                            <TableColumn>
                                <Typography color="blue-gray" className="font-normal text-left">
                                    Vote Weight
                                </Typography>
                            </TableColumn>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {noVotes && (
                            <TableRow>
                                <TableCell colSpan={4}>
                                    <Typography color="blue-gray" className="text-center">
                                        No votes cast by account {account} were found, or the account does not exist.
                                    </Typography>
                                </TableCell>
                            </TableRow>
                        )}
                        {votes?.map((vote) => (
                            <TableRow key={vote.validator}>
                                <TableCell>{vote.validator}</TableCell>
                                <TableCell>{vote.vote_weight.toLocaleString()}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardBody>
        </Card>
    );
}

export function AccountVotes() {
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
                        Account Votes
                    </Typography>
                    <Typography variant="paragraph">Enter an account to look up their votes.</Typography>

                    <form className="mt-4 flex gap-4 2xl:max-w-96 2xl:w-1/4 lg:w-2/3 md:w-full" onSubmit={setAccountInParams}>
                        <Input value={account} onChange={(e) => setAccount(e.target.value)} label="Account" placeholder="Account" className="flex-grow-1" />
                        <Button className="w-32" type="submit">
                            Lookup
                        </Button>
                    </form>
                </CardBody>
            </Card>
            {searchAccount && <AccountVotesCard account={searchAccount} />}
        </div>
    );
}
