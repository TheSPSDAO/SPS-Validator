import { useEffect, useState } from 'react';
import { Hive, HiveService } from '../services/hive';
import { Button, Card, CardBody, CardFooter, CardHeader, Checkbox, Input, Spinner, Typography } from '@material-tailwind/react';
import { AuthorizedAccountWrapper } from '../components/AuthorizedAccountWrapper';
import { DefaultService, Validator } from '../services/openapi';
import { usePromise } from '../hooks/Promise';
import { Link } from 'react-router-dom';
import { TxLookupService } from '../services/TxLookupService';
import { Table, TableBody, TableCell, TableColumn, TableHead, TableRow } from '../components/Table';

function LoadingCard() {
    return (
        <div className="flex justify-center">
            <Card>
                <CardBody>
                    <Typography variant="h5" color="blue-gray" className="mb-2">
                        Please wait
                    </Typography>
                    <div className="flex flex-col gap-4 items-center justify-center">
                        <Spinner />
                        <Typography variant="paragraph">Loading...</Typography>
                    </div>
                </CardBody>
            </Card>
        </div>
    );
}

function ErrorCard({ error, retry }: { error: Error; retry: () => void }) {
    return (
        <div className="flex justify-center">
            <Card>
                <CardBody>
                    <Typography variant="h5" color="blue-gray" className="mb-2">
                        Error
                    </Typography>
                    <div className="flex flex-col items-center justify-center">
                        <Typography variant="paragraph">There was an error getting your validator node status - {error.message}</Typography>
                    </div>
                    <CardFooter>
                        <div className="flex items-center justify-end">
                            <Button onClick={retry}>Retry</Button>
                        </div>
                    </CardFooter>
                </CardBody>
            </Card>
        </div>
    );
}

function RegisterCard({ account, registered }: { account: string; registered: () => void }) {
    const [postUrl, setPostUrl] = useState('');
    const [error, setError] = useState('');
    const [progress, setProgress] = useState(false);

    const register = async () => {
        setProgress(true);
        setError('');
        try {
            const posted = await HiveService.updateValidator(
                {
                    is_active: false,
                    post_url: postUrl,
                },
                account,
            );
            if (!posted.success || posted.error) {
                throw new Error(posted.error ?? 'Failed to register validator node');
            }
            const result = await TxLookupService.waitForTx(posted.result.id);
            if (!result.success) {
                throw new Error(result.error! ?? 'Failed to register validator node');
            }
            registered();
        } catch (err) {
            console.error('Failed to register validator node', err);
            setError(err!.toString());
        } finally {
            setProgress(false);
        }
    };

    return (
        <div className="flex justify-center">
            <Card className="2xl:w-1/3 lg:w-2/3 md:w-full">
                <CardBody>
                    <Typography variant="h5" color="blue-gray" className="mb-2">
                        Register Validator Node - {account}
                    </Typography>
                    <Typography variant="paragraph">
                        Register your validator node to join the network. You can install it from{' '}
                        <a href="https://github.com/TheSPSDAO/SPS-Validator" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
                            here.
                        </a>
                    </Typography>
                    <form className="mt-8 flex flex-col gap-6">
                        <div>
                            <Input
                                size="lg"
                                label="Node URL"
                                placeholder="URL that your node will be accessible from (not required)"
                                value={postUrl}
                                disabled={progress}
                                onChange={(e) => setPostUrl(e.target.value.trim())}
                            />
                        </div>
                    </form>
                </CardBody>
                <CardFooter>
                    {error && (
                        <Typography variant="paragraph" color="red" className="mb-2 text-center">
                            {error}
                        </Typography>
                    )}
                    <div className="flex items-center justify-end">
                        <Button className="flex flex-row items-center" variant="filled" disabled={progress} onClick={register}>
                            {progress && <Spinner className="me-3 text-sm" />}
                            Register
                        </Button>
                    </div>
                </CardFooter>
            </Card>
        </div>
    );
}

function VotesTable({ account, className }: { account: string; className: string }) {
    const [votes, loading] = usePromise(() => DefaultService.getVotesByValidator(account), [account]);
    if (loading) {
        return <Spinner className="w-full" />;
    }
    const totalVotes = votes?.reduce((acc, vote) => acc + vote.vote_weight, 0) ?? 0;
    return (
        <Table className={className}>
            <TableHead>
                <TableRow>
                    <TableColumn>Account</TableColumn>
                    <TableColumn>Vote Weight (total: {totalVotes.toLocaleString()})</TableColumn>
                </TableRow>
            </TableHead>
            <TableBody>
                {votes?.length === 0 && (
                    <TableRow>
                        <TableCell colSpan={2} className="text-center">
                            No votes
                        </TableCell>
                    </TableRow>
                )}
                {votes?.map((vote) => (
                    <TableRow key={vote.voter}>
                        <TableCell>{vote.voter}</TableCell>
                        <TableCell>{vote.vote_weight}</TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    );
}

function StatsTable({ validator }: { validator: Validator }) {
    return (
        <Table className="w-full mt-5 border-2 border-gray-200">
            <TableHead>
                <TableRow>
                    <TableColumn>Field</TableColumn>
                    <TableColumn>Value</TableColumn>
                </TableRow>
            </TableHead>
            <TableBody>
                <TableRow>
                    <TableCell>Account</TableCell>
                    <TableCell>{validator.account_name}</TableCell>
                </TableRow>
                <TableRow>
                    <TableCell>Active</TableCell>
                    <TableCell>{validator.is_active ? 'Yes' : 'No'}</TableCell>
                </TableRow>
                <TableRow>
                    <TableCell>Post URL</TableCell>
                    <TableCell>{validator.post_url ? validator.post_url : 'Not Set'}</TableCell>
                </TableRow>
                <TableRow>
                    <TableCell>Missed Blocks</TableCell>
                    <TableCell>{validator.missed_blocks}</TableCell>
                </TableRow>
                <TableRow>
                    <TableCell>Total Votes</TableCell>
                    <TableCell>{validator.total_votes}</TableCell>
                </TableRow>
            </TableBody>
        </Table>
    );
}

function ManageCard({ account, validator, reloadValidator }: { account: string; validator: Validator; reloadValidator: () => void }) {
    const [isActive, setIsActive] = useState<boolean>(validator.is_active);
    const [postUrl, setPostUrl] = useState<string>(validator.post_url ?? '');
    const [error, setError] = useState('');
    const [progress, setProgress] = useState(false);

    const update = async () => {
        setProgress(true);
        setError('');
        try {
            const updated = await HiveService.updateValidator(
                {
                    is_active: isActive,
                    post_url: postUrl,
                },
                account,
            );
            if (!updated.success || updated.error) {
                throw new Error(updated.error ?? 'Failed to update validator node');
            }
            const result = await TxLookupService.waitForTx(updated.result.id);
            if (!result.success) {
                throw new Error(result.error! ?? 'Failed to update validator node');
            }
            reloadValidator();
        } catch (err) {
            console.error('Failed to update validator node', err);
            setError(err!.toString());
        } finally {
            setProgress(false);
        }
    };

    return (
        <div className="grid xl:grid-cols-4 gap-6">
            <div className="grid grid-cols-4 col-span-full xl:col-span-3 gap-6 auto-rows-min">
                <Card className="col-span-full">
                    <CardBody>
                        <Typography variant="h5" color="blue-gray" className="mb-2">
                            Manage Validator Node - {account}
                        </Typography>
                        <StatsTable validator={validator} />
                    </CardBody>
                </Card>
                <Card className="col-span-full">
                    <CardBody>
                        <Typography variant="h5" color="blue-gray" className="mb-2">
                            Votes On Your Node
                        </Typography>
                        <VotesTable account={account} className="w-full" />
                    </CardBody>
                </Card>
            </div>
            <div className="grid grid-cols-1 col-span-full xl:col-span-1 gap-6 auto-rows-min">
                <Card className="col-span-full">
                    <CardBody>
                        <Typography variant="h5" color="blue-gray" className="mb-2">
                            Manage Validator Node - {account}
                        </Typography>
                        <form className="mt-8 flex flex-col gap-4">
                            <div className="-mx-3">
                                <Checkbox checked={isActive} onChange={(e) => setIsActive(e.target.checked)} label="Active" disabled={progress} />
                            </div>
                            <div>
                                <Input
                                    size="lg"
                                    label="Node URL"
                                    placeholder="URL that your node will be accessible from (not required)"
                                    value={postUrl}
                                    disabled={progress}
                                    onChange={(e) => setPostUrl(e.target.value.trim())}
                                />
                            </div>{' '}
                            {!isActive && (
                                <Typography variant="paragraph" color="red">
                                    You will not be able to validate blocks and receive rewards if your node is inactive.
                                </Typography>
                            )}
                        </form>
                    </CardBody>
                    <CardFooter>
                        {error && (
                            <Typography variant="paragraph" color="red" className="mb-2 text-center">
                                {error}
                            </Typography>
                        )}
                        <div className="flex items-center justify-end">
                            <Button variant="filled" disabled={progress} onClick={update}>
                                {progress && <Spinner className="me-3 text-sm" />}
                                Update
                            </Button>
                        </div>
                    </CardFooter>
                </Card>
            </div>
        </div>
    );
}

export function ManageValidatorNode() {
    const [account, setAccount] = useState<string | undefined>();
    const [validator, loading, error, reloadValidator] = usePromise(() => (account ? DefaultService.getValidator(account) : Promise.resolve(undefined)), [account]);
    const [step, setStep] = useState<'register' | 'registered'>('register');

    useEffect(() => {
        if (!loading && validator) {
            setStep('registered');
        } else {
            setStep('register');
        }
    }, [validator]);

    const realStep = !loading && !error ? step : undefined;

    return (
        <AuthorizedAccountWrapper title="Manage Validator Node" onAuthorized={setAccount} onAuthorizing={() => setAccount(undefined)}>
            {loading && <LoadingCard />}
            {error && <ErrorCard error={error} retry={reloadValidator} />}
            {realStep === 'register' && <RegisterCard account={account!} registered={reloadValidator} />}
            {realStep === 'registered' && <ManageCard account={account!} validator={validator!} reloadValidator={reloadValidator} />}
        </AuthorizedAccountWrapper>
    );
}
