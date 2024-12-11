import { Spinner, Typography, CardBody, Card, Input, Button } from '@material-tailwind/react';
import { FormEvent, useState } from 'react';
import { Table, TableHead, TableRow, TableColumn, TableBody, TableCell, TablePager } from '../components/Table';
import { usePromise } from '../hooks/Promise';
import { DefaultService } from '../services/openapi';
import { Hive } from '../services/hive';

function ValidatorNodesCard({ className }: { className?: string }) {
    const [page, setPage] = useState(0);
    const [limit, setLimit] = useState(10); // TODO: Add a limit selector
    const [search, setSearch] = useState('');
    const [count, isLoadingCount] = usePromise(() => DefaultService.getValidators(0, 0), [search]);
    const [result, isLoading] = usePromise(() => DefaultService.getValidators(limit, page * limit, search), [search]);

    const [workingSearch, setWorkingSearch] = useState('');
    const updateSearch = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setSearch(workingSearch);
        setPage(0);
    };

    if (isLoading || isLoadingCount) {
        return <Spinner className="w-full" />;
    }

    const noValidators = result?.validators === undefined || result.validators.length === 0;
    return (
        <Card className={className}>
            <CardBody>
                <Typography variant="h5" color="blue-gray" className="mb-2">
                    Validators
                </Typography>

                <form className="mt-4 w-96 flex justify-self-end gap-4" onSubmit={updateSearch}>
                    <Input value={workingSearch} onChange={(e) => setWorkingSearch(e.target.value)} label="Account" placeholder="Account" className="flex-grow-1" />
                    <Button className="w-32" type="submit">
                        Search
                    </Button>
                </form>

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
                                    Active
                                </Typography>
                            </TableColumn>
                            <TableColumn>
                                <Typography color="blue-gray" className="font-normal text-left">
                                    Missed Blocks
                                </Typography>
                            </TableColumn>
                            <TableColumn>
                                <Typography color="blue-gray" className="font-normal text-left">
                                    Total Votes
                                </Typography>
                            </TableColumn>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {noValidators && (
                            <TableRow>
                                <TableCell colSpan={4}>
                                    <Typography color="blue-gray" className="text-center">
                                        No validators registered. You can register your validator on this page.
                                    </Typography>
                                </TableCell>
                            </TableRow>
                        )}
                        {result?.validators?.map((validator) => (
                            <TableRow key={validator.account_name}>
                                <TableCell>
                                    <a href={validator.post_url ?? undefined} target="_blank" rel="noreferrer">
                                        {validator.account_name}
                                    </a>
                                </TableCell>
                                <TableCell>{validator.is_active}</TableCell>
                                <TableCell>{validator.missed_blocks.toLocaleString()}</TableCell>
                                <TableCell>{validator.total_votes.toLocaleString()}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
                {count?.count && <TablePager className="w-full justify-center mt-3" page={page} limit={limit} displayPageCount={2} onPageChange={setPage} count={count?.count} />}
            </CardBody>
        </Card>
    );
}

function ValidatorVotesByAccountCard({ className }: { className?: string }) {
    const [account, setAccount] = useState(Hive.ACCOUNT ?? '');
    const [workingAccount, setWorkingAccount] = useState(account);
    const [votes, isLoading] = usePromise(() => (account ? DefaultService.getVotesByAccount(account) : Promise.resolve([])), [account]);

    const updateAccount = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setAccount(workingAccount);
    };

    if (isLoading) {
        return <Spinner className="w-full" />;
    }

    const noVotes = !votes || votes.length === 0;
    return (
        <Card className={className}>
            <CardBody>
                <Typography variant="h5" color="blue-gray" className="mb-2">
                    Votes by Account
                </Typography>

                <form className="mt-4 w-96 flex justify-self-end gap-4" onSubmit={updateAccount}>
                    <Input value={workingAccount} onChange={(e) => setWorkingAccount(e.target.value)} label="Account" placeholder="Account" className="flex-grow-1" />
                    <Button className="w-32" type="submit">
                        Lookup
                    </Button>
                </form>

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
                                        No votes cast by account {account} were found.
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

export function ValidatorNodes() {
    return (
        <div className="grid grid-cols-8 gap-6 auto-rows-min">
            <ValidatorNodesCard className="2xl:col-span-5 col-span-full" />
            <ValidatorVotesByAccountCard className="2xl:col-span-3 col-span-full" />
        </div>
    );
}
