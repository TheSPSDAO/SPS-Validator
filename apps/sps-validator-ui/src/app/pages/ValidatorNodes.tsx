import { Spinner, Typography, CardBody, Card, Input, Button, Checkbox } from '@material-tailwind/react';
import { FormEvent, useRef, useState } from 'react';
import { Table, TableRow, TableBody, TableCell, TablePager, TableHeader, GradientOverflow } from '../components/Table';
import { usePromise } from '../hooks/Promise';
import { DefaultService } from '../services/openapi';
import { Link, useSearchParams } from 'react-router-dom';
import { ValidatorName } from '../components/ValidatorName';
import { localeNumber } from '../components/LocaleNumber';
import { useSpinnerColor } from '../hooks/SpinnerColor'
import { MagnifyingGlassIcon } from '@heroicons/react/24/solid';
import { CardHeader } from '@material-tailwind/react';
import { ValidatorDialog } from '../components/ValidatorDialog';


function ValidatorNodesCard({ className, onNodeSelected }: { className?: string; onNodeSelected?: (node: string) => void }) {
    const [page, setPage] = useState(0);
    const [limit, setLimit] = useState(10); // TODO: Add a limit selector
    const [search, setSearch] = useState('');
    const [count, isLoadingCount] = usePromise(() => DefaultService.getValidators(0, 0), [search]);
    const spinnerColor = useSpinnerColor("blue")
    const containerRef = useRef<HTMLDivElement | null>(null);

    const [active, setActive] = useState<undefined | boolean>(undefined);
    const updateActive = () => {
        setPage(0);
        setActive(active ? undefined : true);
    };
    const [workingSearch, setWorkingSearch] = useState('');
    const updateSearch = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setSearch(workingSearch);
        setPage(0);
    };

    const [result, isLoading] = usePromise(() => DefaultService.getValidators(limit, page * limit, search, active), [search, page, limit, active]);
    if (isLoading || isLoadingCount) {
        return <Spinner className="w-full" color={spinnerColor}/>;
    }

    const noValidators = result?.validators === undefined || result.validators.length === 0;
    return (
        <Card className={className}>
            <CardBody className="overflow-x-auto">
                <Typography variant="h5" color="blue-gray" className="mb-6 dark:text-gray-200">
                    Validators
                </Typography>
                
                <form className="mt-4 w-full flex justify-end gap-4 flex-col sm:flex-row" onSubmit={updateSearch}>
                    <div>
                        <Checkbox 
                            checked={active ?? false} 
                            onChange={(e) => updateActive()} 
                            label="Active Only" 
                            className="dark:checked:bg-blue-800 dark:border-gray-300 dark:before:bg-blue-400 dark:checked:before:bg-blue-400 dark:text-gray-300" 
                            labelProps={{className: "dark:text-gray-300"}}
                        />
                    </div>
                    <div className="flex gap-4 sm:max-w-[400px]">
                        <Input 
                            value={workingSearch} 
                            onChange={(e) => setWorkingSearch(e.target.value)} 
                            label="Account" 
                            placeholder="Account" 
                            className="flex-grow-1 dark:text-gray-300 dark:border-gray-300 dark:placeholder-shown:border-t-gray-300 dark:focus:border-gray-200 dark:focus:border-t-transparent dark:placeholder:text-gray-300 dark:focus:placeholder:text-gray-500 dark:border-t-transparent" 
                            labelProps={{className: "dark:peer-placeholder-shown:text-gray-300 dark:placeholder:text-gray-300 dark:text-gray-300 dark:peer-focus:text-gray-300 dark:peer-focus:before:!border-gray-200 dark:peer-focus:after:!border-gray-200 dark:before:border-gray-300 dark:after:border-gray-300"}}
                        />
                        <Button className="p-2 sm:w-32 dark:bg-blue-800 dark:hover:bg-blue-600 dark:border-gray-300 dark:border dark:text-gray-300 dark:hover:text-gray-100 dark:shadow-none" type="submit">
                            <MagnifyingGlassIcon className="sm:hidden h-6 w-6"/>
                            <p className="sr-only sm:not-sr-only">Search</p>
                        </Button>
                    </div>
                </form>
                <div className="relative mt-4">
                    <div ref={containerRef} className="overflow-x-auto">
                        <Table className="w-full border-2 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-300">
                            <TableHeader columns={["Validator", "Last Version", "Active", "Missed Blocks", "Total Votes", ""]} />
                            <TableBody>
                                {noValidators && page===0 && (
                                    <TableRow className="dark:border-gray-300">
                                        <TableCell colSpan={5}>
                                            <Typography color="blue-gray" className="text-center dark:text-gray-300">
                                                No validators registered. You can register your validator{' '}
                                                <Link to="/validator-nodes/manage" className="text-blue-600 underline dark:text-blue-500">
                                                    here.
                                                </Link>
                                            </Typography>
                                        </TableCell>
                                    </TableRow>
                                )}
                                {noValidators && page>0 && (
                                    <TableRow className="dark:border-gray-300">
                                        <TableCell colSpan={5}>
                                            <Typography color="blue-gray" className="text-center dark:text-gray-300">
                                                No more active validators to show.
                                            </Typography>
                                        </TableCell>
                                    </TableRow>
                                )}
                                {result?.validators?.map((validator) => (
                                    <TableRow key={validator.account_name}  className="dark:border-gray-300">
                                        <TableCell>
                                            <ValidatorName {...validator} link_to_validator={false} />
                                        </TableCell>
                                        <TableCell>{validator.last_version ?? 'unknown'}</TableCell>
                                        <TableCell>{validator.is_active ? 'Yes' : 'No'}</TableCell>
                                        <TableCell>{localeNumber(validator.missed_blocks, 0)}</TableCell>
                                        <TableCell>{localeNumber(validator.total_votes)}</TableCell>
                                        <TableCell>
                                            <Button onClick={() => onNodeSelected?.(validator.account_name)} size="sm" className="dark:bg-blue-800 dark:hover:bg-blue-600 dark:border-gray-300 dark:border dark:text-gray-300 dark:hover:text-gray-100 dark:shadow-none">
                                                View
                                            </Button>
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

export function ValidatorNodes() {
    const [searchParams, setSearchParams] = useSearchParams({
        node: '',
    });
    const selectedNode = searchParams.get('node')?.trim() ?? '';
    const hasSelectedNode = selectedNode !== '' && selectedNode !== null;
    const selectNode = (node: string) => {
        setSearchParams({ node });
    };
    return (
        <div className="grid grid-cols-8 gap-6 auto-rows-min">
            <ValidatorNodesCard className="col-span-full dark:bg-gray-800 dark:shadow-none" onNodeSelected={selectNode} />
            <ValidatorDialog open={hasSelectedNode} onClose={() => setSearchParams({ node: '' })} selectedNode={selectedNode} />
        </div>
    );
}
