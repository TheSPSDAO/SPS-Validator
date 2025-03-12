import {FormEvent, useRef, useState } from 'react';
import { Hive, HiveService } from '../services/hive';
import { Button, Card, CardBody, CardFooter, Input, Spinner, Typography } from '@material-tailwind/react';
import { AuthorizedAccountWrapper } from '../components/AuthorizedAccountWrapper';
import { usePromise } from '../hooks/Promise';
import { DefaultService, ValidatorConfig, ValidatorVote } from '../services/openapi';
import { Table, TableBody, TableCell, TableHeader, TablePager, TableRow, GradientOverflow } from '../components/Table';
import { TxLookupService } from '../services/TxLookupService';
import { Link, useSearchParams } from 'react-router-dom';
import { useSpinnerColor } from '../hooks/SpinnerColor'
import { MagnifyingGlassIcon, TrashIcon, EyeIcon } from '@heroicons/react/24/solid';
import { ValidatorName } from '../components/ValidatorName';
import { localeNumber } from '../components/LocaleNumber';
import { ValidatorDialog } from '../components/ValidatorDialog';

function VoteCard({
    account,
    votes,
    config,
    reloadVotes,
    onNodeSelected,
}: {
    account: string;
    votes: ValidatorVote[];
    config: ValidatorConfig;
    reloadVotes: () => void;
    onNodeSelected: (node: string) => void;
}) {
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
        <Card className="3xl:col-span-3 dark:bg-gray-800 dark:text-gray-300 dark:shadow-none">
            <CardBody>
                <Typography variant="h5" color="blue-gray" className="mb-6 dark:text-gray-200">
                    Vote for Validator
                </Typography>

                {error && (
                    <Typography variant="paragraph" color="red" className="text-sm">
                        {error}
                    </Typography>
                )}

                <div className="mt-2">
                    <Typography variant="paragraph" color="blue-gray" className="text-sm dark:text-gray-300">
                        You have used {votes.length} out of {config.max_votes} votes
                    </Typography>
                </div>

                <div className="mt-2">
                    <Typography variant="h6" color="blue-gray" className="dark:text-gray-200">
                        Criteria to keep in mind when voting
                    </Typography>
                    <Typography variant="paragraph" color="blue-gray" className="text-md dark:text-gray-300">
                        <ul className="list-disc list-inside">
                            <li>Validators are responsible for validating blocks that are based off sps transactions on the Hive blockchain.</li>
                            <li>Validators with the most votes have a higher chance to be selected to validate blocks, so vote for validators you trust.</li>
                            <li>Validators with a PeakD post describing their node setup are more likely to be a quality node.</li>
                            <li>
                                Validators with an API URL set are making their node available to everybody else. Validators without one are not contributing as much to the SPS
                                chain.
                            </li>
                            <li>Validators with a high missed block count indicates their node is not reliable. Validators with a low missed block count are more reliable.</li>
                            <li>Validators on the most recent version of the validator software should be chosen over validators on an older version.</li>
                        </ul>
                    </Typography>
                </div>

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
                            <TableHeader columns={["Validator", "Last Version", "Active", "Missed Blocks", "Total Votes", ""]} />
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
                                            <ValidatorName {...validator} link_to_validator={true} />
                                        </TableCell>
                                        <TableCell>{validator.last_version ?? 'unknown'}</TableCell>
                                        <TableCell>{validator.is_active ? 'Yes' : 'No'}</TableCell>
                                        <TableCell>{localeNumber(validator.missed_blocks, 0)}</TableCell>
                                        <TableCell>{localeNumber(validator.total_votes)}</TableCell>
                                        <TableCell>
                                            <div className="flex flex-col md:flex-row justify-center align-middle">
                                                <Button 
                                                    disabled={progress} 
                                                    onClick={() => onNodeSelected(validator.account_name)} 
                                                    size="sm" 
                                                    className="md:me-2 mb-2 md:mb-0 dark:bg-blue-800 dark:hover:bg-blue-600 dark:border-gray-300 dark:border dark:text-gray-300 dark:hover:text-gray-100 dark:shadow-none"
                                                >
                                                    View
                                                </Button>
                                                <Button
                                                    disabled={votes.some((v) => v.validator === validator.account_name) || progress}
                                                    onClick={() => voteFor(validator.account_name)}
                                                    size="sm"
                                                    className="dark:bg-blue-800 dark:hover:bg-blue-600 dark:border-gray-300 dark:border dark:text-gray-300 dark:hover:text-gray-100 dark:shadow-none"
                                                >
                                                    Vote {votes.some((v) => v.validator === validator.account_name) && '(already voted)'}
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
                {count?.count && <TablePager className="w-full justify-center mt-3" page={page} limit={limit} displayPageCount={2} onPageChange={setPage} count={count?.count} containerRef={containerRef} />}
            </CardBody>
        </Card>
    );
}

function MyVotesCard({
    account,
    votes,
    config,
    reloadVotes,
    onNodeSelected,
}: {
    account: string;
    votes: ValidatorVote[];
    config: ValidatorConfig;
    reloadVotes: () => void;
    onNodeSelected: (node: string) => void;
}) {
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
        <Card className="3xl:col-span-2 dark:bg-gray-800 dark:text-gray-300 dark:shadow-none">
            <CardBody>
                <Typography variant="h5" color="blue-gray" className="mb-6 dark:text-gray-200">
                    My Votes
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
                            <TableHeader columns={["Validator", "Vote Weight", ""]} />
                            <TableBody>
                                {votes.map((vote) => (
                                    <TableRow key={vote.validator}  className="dark:border-gray-300">
                                        <TableCell>{vote.validator}</TableCell>
                                        <TableCell>{localeNumber(vote.vote_weight)}</TableCell>
                                        <TableCell>
                                            <div className="flex justify-center">
                                                <Button disabled={progress} onClick={() => onNodeSelected(vote.validator)} size="sm" className="me-2 p-2 sm:px-4 dark:bg-blue-800 dark:hover:bg-blue-600 dark:border-gray-300 dark:border dark:text-gray-300 dark:hover:text-gray-100 dark:shadow-none">
                                                    <EyeIcon className="sm:hidden size-6" />
                                                    <p className="sr-only sm:not-sr-only">View</p>
                                                </Button>
                                                <Button className="p-2 sm:px-4 dark:bg-blue-800 dark:hover:bg-blue-600 dark:border-gray-300 dark:border dark:text-gray-300 dark:hover:text-gray-100 dark:shadow-none" disabled={progress} onClick={() => removeVote(vote.validator)}>
                                                    <div className="flex flex-row items-center">
                                                        {progress && <Spinner className="me-3" width={16} height={16} color={spinnerColor} />}
                                                        <TrashIcon className="sm:hidden size-6"/>
                                                        <p className="sr-only sm:not-sr-only">Remove Vote</p>
                                                    </div>
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
    const [searchParams, setSearchParams] = useSearchParams({
        node: '',
    });
    const selectedNode = searchParams.get('node')?.trim() ?? '';
    const hasSelectedNode = selectedNode !== '' && selectedNode !== null;
    const selectNode = (node: string) => {
        setSearchParams({ node });
    };
    return (
        <AuthorizedAccountWrapper title="Manage Votes" onAuthorized={setAccount} onAuthorizing={() => setAccount(undefined)}>
            <div className="grid grid-cols-1 3xl:grid-cols-5 gap-4">
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
                {loaded && <MyVotesCard votes={votes} config={validatorConfig} reloadVotes={reloadVotes} account={account} onNodeSelected={selectNode} />}
                {loaded && <VoteCard votes={votes} config={validatorConfig} reloadVotes={reloadVotes} account={account} onNodeSelected={selectNode} />}
                <ValidatorDialog open={hasSelectedNode} onClose={() => setSearchParams({ node: '' })} selectedNode={selectedNode} />
            </div>
        </AuthorizedAccountWrapper>
    );
}
