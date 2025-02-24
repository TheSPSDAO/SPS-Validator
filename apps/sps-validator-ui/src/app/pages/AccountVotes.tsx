import { FormEvent, useRef, useState } from 'react';
import { Hive } from '../services/hive';
import { usePromise } from '../hooks/Promise';
import { DefaultService } from '../services/openapi';
import { Button, Card, CardBody, Input, Spinner, Typography } from '@material-tailwind/react';
import { TableHead, TableRow, TableColumn, TableBody, TableCell, Table } from '../components/Table';
import { useSearchParams } from 'react-router-dom';
import useSpinnerColor from '../hooks/SpinnerColor'
import { MagnifyingGlassIcon } from '@heroicons/react/24/solid';
import { GradientOverflow} from '../components/GradientOverflow'

function AccountVotesCard({ account }: { account: string }) {
    const [votes, isLoading] = usePromise(() => DefaultService.getVotesByAccount(account), [account]);
    const spinnerColor = useSpinnerColor("blue")
    const containerRef = useRef<HTMLDivElement | null>(null);

    if (isLoading) {
        return <Spinner className="w-full" color={spinnerColor}/>;
    }

    const noVotes = !votes || votes.length === 0;
    return (
        <Card className="dark:bg-gray-800 dark:text-gray-300 dark:shadow-none">
            <CardBody>
                <Typography variant="h5" color="blue-gray" className="mb-6 dark:text-gray-200">
                    Votes by {account}
                </Typography>
                <div className="relative">
                    <div ref={containerRef} className="overflow-x-auto">
                        <Table className="w-full dark:bg-gray-800 dark:text-gray-300 dark:border-gray-300">
                            <TableHead>
                                <TableRow>
                                    <TableColumn className="dark:bg-gray-300">
                                        <Typography color="blue-gray" className="font-normal text-left dark:text-gray-800">
                                            Validator
                                        </Typography>
                                    </TableColumn>
                                    <TableColumn className="dark:bg-gray-300">
                                        <Typography color="blue-gray" className="font-normal text-left dark:text-gray-800">
                                            Vote Weight
                                        </Typography>
                                    </TableColumn>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {noVotes && (
                                    <TableRow className="dark:border-gray-300">
                                        <TableCell colSpan={4}>
                                            <Typography color="blue-gray" className="text-center dark:text-gray-300">
                                                No votes cast by account {account} were found, or the account does not exist.
                                            </Typography>
                                        </TableCell>
                                    </TableRow>
                                )}
                                {votes?.map((vote) => (
                                    <TableRow key={vote.validator} className="dark:border-gray-300">
                                        <TableCell>{vote.validator}</TableCell>
                                        <TableCell>{vote.vote_weight.toLocaleString()}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                    <GradientOverflow isLoading={isLoading} containerRef={containerRef} />
                </div>
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
            <Card className="dark:bg-gray-800 dark:text-gray-300 dark:shadow-none">
                <CardBody>
                    <Typography variant="h5" color="blue-gray" className="mb-2 dark:text-gray-200">
                        Account Votes
                    </Typography>
                    <Typography variant="paragraph">Enter an account to look up their votes.</Typography>

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
            {searchAccount && <AccountVotesCard account={searchAccount} />}
        </div>
    );
}
