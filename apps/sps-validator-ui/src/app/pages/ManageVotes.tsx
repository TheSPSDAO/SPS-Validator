import { FormEvent, useEffect, useState } from 'react';
import { Hive, HiveService } from '../services/hive';
import { Button, Card, CardBody, CardFooter, Input, Spinner, Typography } from '@material-tailwind/react';
import { AuthorizedAccountWrapper } from '../components/AuthorizedAccountWrapper';
import { usePromise } from '../hooks/Promise';
import { DefaultService, ValidatorConfig, ValidatorVote } from '../services/openapi';
import { Table, TableBody, TableCell, TableColumn, TableHead, TablePager, TableRow } from '../components/Table';
import { TxLookupService } from '../services/TxLookupService';
import { Link } from 'react-router-dom';

function VoteCard({ account, votes, config, reloadVotes }: { account: string; votes: ValidatorVote[]; config: ValidatorConfig; reloadVotes: () => void }) {
    const [progress, setProgress] = useState<boolean>(false);
    const [error, setError] = useState<string>('');
    const [page, setPage] = useState(0);
    const [limit, setLimit] = useState(10); // TODO: Add a limit selector
    const [search, setSearch] = useState('');
    const [count, isLoadingCount] = usePromise(() => DefaultService.getValidators(0, 0), [search]);
    const [result, isLoading] = usePromise(() => DefaultService.getValidators(limit, page * limit, search), [search, limit, page]);

    const [workingSearch, setWorkingSearch] = useState('');
    const updateSearch = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setSearch(workingSearch);
        setPage(0);
    };

    const voteFor = async (validator: string) => {
        setError('');
        setProgress(true);
        try {
            const broadcastResult = await HiveService.approveValidator({
                account_name: validator,
            });
            if (broadcastResult.error || !broadcastResult.result) {
                throw new Error(broadcastResult.error ?? 'There was an error broadcasting the transaction');
            }
            const txResult = await TxLookupService.waitForTx(broadcastResult.result!.id);
            if (!txResult.success) {
                throw new Error(txResult.error ?? 'There was an error broadcasting the transaction');
            }
            reloadVotes();
        } catch (err) {
            setError(err!.toString());
        } finally {
            setProgress(false);
        }
    };

    if (isLoading || isLoadingCount) {
        return <Spinner className="w-full" />;
    }

    const noValidators = result?.validators === undefined || result.validators.length === 0;

    return (
        <Card>
            <CardBody>
                <Typography variant="h5" color="blue-gray" className="mb-2">
                    Vote for Validator - {account}
                </Typography>

                {error && (
                    <Typography variant="paragraph" color="red" className="text-sm">
                        {error}
                    </Typography>
                )}

                <form className="mt-4 w-96 flex justify-self-end gap-4" onSubmit={updateSearch}>
                    <Input value={workingSearch} onChange={(e) => setWorkingSearch(e.target.value)} label="Account" placeholder="Account" className="flex-grow-1" />
                    <Button className="w-32" type="submit">
                        Search
                    </Button>
                </form>

                <Table className="w-full mt-4 border-2 border-gray-200 ">
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
                            <TableColumn />
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {noValidators && (
                            <TableRow>
                                <TableCell colSpan={4}>
                                    <Typography color="blue-gray" className="text-center">
                                        No validators registered. You can register your validator{' '}
                                        <Link to="/validator-nodes/manage" className="text-blue-600 underline">
                                            here.
                                        </Link>
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
                                <TableCell>{validator.is_active ? 'Yes' : 'No'}</TableCell>
                                <TableCell>{validator.missed_blocks.toLocaleString()}</TableCell>
                                <TableCell>{validator.total_votes.toLocaleString()}</TableCell>
                                <TableCell>
                                    <Button
                                        disabled={votes.some((v) => v.validator === validator.account_name) || progress}
                                        onClick={() => voteFor(validator.account_name)}
                                        size="sm"
                                    >
                                        Vote
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
                {count?.count && <TablePager className="w-full justify-center mt-3" page={page} limit={limit} displayPageCount={2} onPageChange={setPage} count={count?.count} />}
            </CardBody>
        </Card>
    );
}

function MyVotesCard({ account, votes, config, reloadVotes }: { account: string; votes: ValidatorVote[]; config: ValidatorConfig; reloadVotes: () => void }) {
    const [progress, setProgress] = useState<boolean>(false);
    const [error, setError] = useState<string>('');
    const removeVote = async (validator: string) => {
        setError('');
        setProgress(true);
        try {
            const broadcastResult = await HiveService.disapproveValidator({
                account_name: validator,
            });
            if (broadcastResult.error || !broadcastResult.result) {
                throw new Error(broadcastResult.error ?? 'There was an error broadcasting the transaction');
            }
            const txResult = await TxLookupService.waitForTx(broadcastResult.result!.id);
            if (!txResult.success) {
                throw new Error(txResult.error ?? 'There was an error broadcasting the transaction');
            }
            reloadVotes();
        } catch (err) {
            setError(err!.toString());
        } finally {
            setProgress(false);
        }
    };
    return (
        <Card>
            <CardBody>
                <Typography variant="h5" color="blue-gray" className="mb-2">
                    My Votes - {account}
                </Typography>
                <div>
                    <Typography variant="paragraph" color="blue-gray" className="text-sm">
                        You have used {votes.length} out of {config.max_votes} votes
                    </Typography>
                    {error && (
                        <Typography variant="paragraph" color="red" className="text-sm">
                            {error}
                        </Typography>
                    )}
                </div>
                <Table className="w-full mt-4 border-2 border-gray-200">
                    <TableHead>
                        <TableRow>
                            <TableColumn>Validator</TableColumn>
                            <TableColumn>Vote Weight</TableColumn>
                            <TableColumn />
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {votes.map((vote) => (
                            <TableRow key={vote.validator}>
                                <TableCell>{vote.validator}</TableCell>
                                <TableCell>{vote.vote_weight}</TableCell>
                                <TableCell>
                                    <Button className="flex flex-row items-center" disabled={progress} onClick={() => removeVote(vote.validator)}>
                                        {progress && <Spinner className="me-3 text-sm" />}
                                        Remove
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardBody>
        </Card>
    );
}

export function ManageVotes() {
    const [account, setAccount] = useState<string | undefined>();
    const [votes, votesLoading, votesError, reloadVotes] = usePromise(() => (account ? DefaultService.getVotesByAccount(account!) : Promise.resolve([])), [account]);
    const [validatorConfig, validatorConfigLoading, validatorConfigError, reloadConfig] = usePromise(() => DefaultService.getValidatorConfig(), []);
    const loaded = !votesLoading && !validatorConfigLoading && account && votes && validatorConfig;
    const error = (votesError || validatorConfigError)?.message;
    const reloadAll = () => {
        reloadVotes();
        reloadConfig();
    };
    return (
        <AuthorizedAccountWrapper title="Manage Votes" onAuthorized={setAccount} onAuthorizing={() => setAccount(undefined)}>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {!loaded && !error && <Spinner className="w-full col-span-full" />}
                {error && (
                    <Card className="col-span-full">
                        <CardBody>
                            <Typography variant="h5" color="blue-gray" className="mb-2">
                                Error
                            </Typography>
                            <Typography variant="paragraph" color="red" className="text-sm">
                                There was an error loading your validator votes - {error}
                            </Typography>
                        </CardBody>
                        <CardFooter>
                            <div className="flex flex-row justify-end gap-4">
                                <Button onClick={reloadAll} size="sm">
                                    Retry
                                </Button>
                            </div>
                        </CardFooter>
                    </Card>
                )}
                {loaded && <MyVotesCard votes={votes} config={validatorConfig} reloadVotes={reloadVotes} account={account} />}
                {loaded && <VoteCard votes={votes} config={validatorConfig} reloadVotes={reloadVotes} account={account} />}
            </div>
        </AuthorizedAccountWrapper>
    );
}
