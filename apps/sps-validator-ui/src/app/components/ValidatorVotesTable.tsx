import { Spinner } from '@material-tailwind/react';
import { usePromise } from '../hooks/Promise';
import { DefaultService } from '../services/openapi';
import { Table, TableBody, TableCell, TableHeader, TablePager, TableRow } from './Table';
import { useState } from 'react';
import { localeNumber } from './LocaleNumber';

export function ValidatorVotesTable({ account, className }: { account: string; className?: string }) {
    const [page, setPage] = useState(0);
    const [limit, setLimit] = useState(10); // TODO: Add a limit selector
    const [votes, loading] = usePromise(() => DefaultService.getVotesByValidator(account), [account]);
    if (loading) {
        return <Spinner className="w-full" />;
    }
    const totalVotes = votes?.reduce((acc, vote) => acc + Number(vote.vote_weight), 0) ?? 0;
    const voteWeightHeader = `Vote Weight (total: ${localeNumber(totalVotes)})`;
    return (
        <div>
            <Table className={`border-2 border-gray-200 dark:border-gray-300 ${className}`}>
                <TableHeader columns={["Account", voteWeightHeader]} />
                <TableBody>
                    {votes?.length === 0 && (
                        <TableRow className="dark:border-gray-300">
                            <TableCell colSpan={2} className="text-center">
                                No votes
                            </TableCell>
                        </TableRow>
                    )}
                    {votes?.slice(page * limit, page * limit + limit).map((vote) => (
                        <TableRow className="dark:border-gray-300" key={vote.voter}>
                            <TableCell>{vote.voter}</TableCell>
                            <TableCell>{localeNumber(vote.vote_weight)}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
            {votes && votes.length >= limit && (
                <TablePager className="w-full justify-center mt-3" page={page} limit={limit} displayPageCount={2} onPageChange={setPage} count={votes.length} />
            )}
        </div>
    );
}
