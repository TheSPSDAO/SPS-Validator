import React, {FormEvent, useEffect, useRef, useState } from 'react';
import { Hive, HiveService } from '../services/hive';
import { Button, Card, CardBody, CardFooter, Input, Spinner, Typography } from '@material-tailwind/react';
import { AuthorizedAccountWrapper } from '../components/AuthorizedAccountWrapper';
import { usePromise } from '../hooks/Promise';
import { DefaultService, ValidatorConfig, ValidatorVote } from '../services/openapi';
import { Table, TableBody, TableCell, TableColumn, TableHead, TablePager, TableRow } from '../components/Table';
import { TxLookupService } from '../services/TxLookupService';
import { Link } from 'react-router-dom';
import useSpinnerColor from '../hooks/SpinnerColor'
import { MagnifyingGlassIcon, TrashIcon } from '@heroicons/react/24/solid';
import { GradientOverflow } from '../components/GradientOverflow';

function VoteCard({ account, votes, config, reloadVotes }: { account: string; votes: ValidatorVote[]; config: ValidatorConfig; reloadVotes: () => void }) {
    const [progress, setProgress] = useState<boolean>(false);
    const [error, setError] = useState<string>('');
    const [page, setPage] = useState(0);
    const [limit, setLimit] = useState(10); // TODO: Add a limit selector
    const [search, setSearch] = useState('');
    const [count, isLoadingCount] = usePromise(() => DefaultService.getValidators(0, 0), [search]);
    const [result, isLoading] = usePromise(() => DefaultService.getValidators(limit, page * limit, search), [search, limit, page]);
    const spinnerColor = useSpinnerColor("blue")
    const containerRef = useRef<HTMLDivElement | null>(null);

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
        return <Spinner className="w-full" color={spinnerColor}/>;
    }

    const noValidators = result?.validators === undefined || result.validators.length === 0;

    return (
        <Card className="dark:bg-gray-800 dark:text-gray-300 dark:shadow-none">
            <CardBody>
                <Typography variant="h5" color="blue-gray" className="mb-6 dark:text-gray-200">
                    Vote for Validator - {account}
                </Typography>

                {error && (
                    <Typography variant="paragraph" color="red" className="text-sm">
                        {error}
                    </Typography>
                )}

                <form className="mt-4 w-full sm:max-w-[400px] flex justify-self-end gap-4" onSubmit={updateSearch}>
                    <Input 
                        value={workingSearch} 
                        onChange={(e) => setWorkingSearch(e.target.value)} 
                        label="Account" 
                        placeholder="Account" 
                        className="flex-grow-1 dark:text-gray-300 dark:border-gray-300 dark:placeholder-shown:border-t-gray-300 dark:focus:border-gray-200 dark:focus:border-t-transparent dark:placeholder:text-gray-300 dark:focus:placeholder:text-gray-500 dark:border-t-transparent" 
                        labelProps={{className: "dark:peer-placeholder-shown:text-gray-300 dark:placeholder:text-gray-300 dark:text-gray-300 dark:peer-focus:text-gray-300 dark:peer-focus:before:!border-gray-200 dark:peer-focus:after:!border-gray-200 dark:before:border-gray-300 dark:after:border-gray-300"}} 
                    />
                    <Button className="p-2 sm:w-32 dark:bg-blue-800 dark:hover:bg-blue-600 dark:border-gray-300 dark:border dark:text-gray-300 dark:hover:text-gray-100 dark:shadow-none" type="submit">
                        <MagnifyingGlassIcon className="sm:hidden size-6"/>
                        <p className="sr-only sm:not-sr-only">Search</p>
                    
                    </Button>
                </form>
                <div className="relative mt-4">
                    <div ref={containerRef} className="overflow-x-auto">
                        <Table className="w-full border-2 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-300">
                            <TableHead>
                                <TableRow>
                                    <TableColumn className="dark:bg-gray-300">
                                        <Typography color="blue-gray" className="font-normal text-left dark:text-gray-800">
                                            Validator
                                        </Typography>
                                    </TableColumn>
                                    <TableColumn className="dark:bg-gray-300">
                                        <Typography color="blue-gray" className="font-normal text-left dark:text-gray-800">
                                            Active
                                        </Typography>
                                    </TableColumn>
                                    <TableColumn className="dark:bg-gray-300">
                                        <Typography color="blue-gray" className="font-normal text-left dark:text-gray-800">
                                            Missed Blocks
                                        </Typography>
                                    </TableColumn>
                                    <TableColumn className="dark:bg-gray-300">
                                        <Typography color="blue-gray" className="font-normal text-left dark:text-gray-800">
                                            Total Votes
                                        </Typography>
                                    </TableColumn >
                                    <TableColumn className="dark:bg-gray-300" />
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {noValidators && (
                                    <TableRow className="dark:border-gray-300">
                                        <TableCell colSpan={4}>
                                            <Typography color="blue-gray" className="text-center dark:text-gray-300">
                                                No validators registered. You can register your validator{' '}
                                                <Link to="/validator-nodes/manage" className="text-blue-600 underline dark:text-blue-500">
                                                    here.
                                                </Link>
                                            </Typography>
                                        </TableCell>
                                    </TableRow>
                                )}
                                {result?.validators?.map((validator) => (
                                    <TableRow key={validator.account_name} className="dark:border-gray-300">
                                        <TableCell>
                                            <a href={validator.post_url ?? undefined} target="_blank" rel="noreferrer">
                                                {validator.account_name}
                                            </a>
                                        </TableCell>
                                        <TableCell>{validator.is_active ? 'Yes' : 'No'}</TableCell>
                                        <TableCell>{validator.missed_blocks.toLocaleString()}</TableCell>
                                        <TableCell>{validator.total_votes.toLocaleString()}</TableCell>
                                        <TableCell>
                                            <div className="flex justify-center">
                                                <Button
                                                    disabled={votes.some((v) => v.validator === validator.account_name) || progress}
                                                    onClick={() => voteFor(validator.account_name)}
                                                    size="sm"
                                                    className="dark:bg-blue-800 dark:hover:bg-blue-600 dark:border-gray-300 dark:border dark:text-gray-300 dark:hover:text-gray-100 dark:shadow-none"
                                                >
                                                    Vote
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                    <GradientOverflow isLoading={isLoading} containerRef={containerRef} />
                </div>
                {count?.count && <TablePager className="w-full justify-center mt-3" page={page} limit={limit} displayPageCount={2} onPageChange={setPage} count={count?.count} />}
            </CardBody>
        </Card>
    );
}

function MyVotesCard({ account, votes, config, reloadVotes }: { account: string; votes: ValidatorVote[]; config: ValidatorConfig; reloadVotes: () => void }) {
    const [progress, setProgress] = useState<boolean>(false);
    const [error, setError] = useState<string>('');
    const spinnerColor = useSpinnerColor("teal");
    const containerRef = useRef<HTMLDivElement | null>(null);
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
        <Card className="dark:bg-gray-800 dark:text-gray-300 dark:shadow-none">
            <CardBody>
                <Typography variant="h5" color="blue-gray" className="mb-6 dark:text-gray-200">
                    My Votes - {account}
                </Typography>
                <div>
                    <Typography variant="paragraph" color="blue-gray" className="text-sm dark:text-gray-300">
                        You have used {votes.length} out of {config.max_votes} votes
                    </Typography>
                    {error && (
                        <Typography variant="paragraph" color="red" className="text-sm dark:text-gray-300">
                            {error}
                        </Typography>
                    )}
                </div>
                <div className="relative">
                    <div ref={containerRef} className="overflow-x-auto">
                        <Table className="w-full border-2 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-300">
                            <TableHead>
                                <TableRow>
                                    <TableColumn className="dark:bg-gray-300 dark:text-gray-800">Validator</TableColumn>
                                    <TableColumn className="dark:bg-gray-300 dark:text-gray-800">Vote Weight</TableColumn>
                                    <TableColumn className="dark:bg-gray-300" />
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {votes.map((vote) => (
                                    <TableRow key={vote.validator}  className="dark:border-gray-300">
                                        <TableCell>{vote.validator}</TableCell>
                                        <TableCell>{vote.vote_weight}</TableCell>
                                        <TableCell>
                                            <div className="flex justify-center">
                                                <Button className="flex flex-row items-center p-2 sm:py-3 sm:px-6 dark:bg-blue-800 dark:hover:bg-blue-600 dark:border-gray-300 dark:border dark:text-gray-300 dark:hover:text-gray-100 dark:shadow-none" disabled={progress} onClick={() => removeVote(vote.validator)}>
                                                    {progress && <Spinner className="me-3 text-sm" color={spinnerColor} />}
                                                    <TrashIcon className="sm:hidden size-6"/>
                                                    <p className="sr-only sm:not-sr-only">Remove</p>
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                    <GradientOverflow isLoading={false} containerRef={containerRef} />
                </div>
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
    const spinnerColor = useSpinnerColor("blue")
    const reloadAll = () => {
        reloadVotes();
        reloadConfig();
    };
    return (
        <AuthorizedAccountWrapper title="Manage Votes" onAuthorized={setAccount} onAuthorizing={() => setAccount(undefined)}>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {!loaded && !error && <Spinner className="w-full col-span-full" color={spinnerColor} />}
                {error && (
                    <Card className="col-span-full dark:bg-gray-800 dark:text-gray-300 dark:shadow-none">
                        <CardBody>
                            <Typography variant="h5" color="blue-gray" className="mb-2 dark:text-gray-200">
                                Error
                            </Typography>
                            <Typography variant="paragraph" color="red" className="text-sm">
                                There was an error loading your validator votes - {error}
                            </Typography>
                        </CardBody>
                        <CardFooter>
                            <div className="flex flex-row justify-end gap-4">
                                <Button onClick={reloadAll} size="sm" className="dark:bg-blue-800 dark:hover:bg-blue-600 dark:border-gray-300 dark:border dark:text-gray-300 dark:hover:text-gray-100 dark:shadow-none">
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
