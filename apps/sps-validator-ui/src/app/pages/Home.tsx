import { Card, CardBody, List, ListItem, Spinner, Typography } from '@material-tailwind/react';
import { Link } from 'react-router-dom';
import { usePromise } from '../hooks/Promise';
import { DefaultService } from '../services/openapi';
import React, { useRef } from 'react';
import { Table, TableRow, TableBody, TableCell, TableHeader, GradientOverflow } from '../components/Table';
import { useMetrics } from '../context/MetricsContext';
import { ValidatorName } from '../components/ValidatorName';
import { localeNumber } from '../components/LocaleNumber';
import { useSpinnerColor } from '../hooks/SpinnerColor'

const usefulLinks = [
    { name: 'Splinterlands', url: 'https://splinterlands.com' },
    { name: 'SPS Whitepaper', url: 'https://sps.splinterlands.com/' },
    { name: 'SPS DAO', url: 'https://sps.splinterlands.com/dao' },
];
function UsefulLinksCard() {
    return (
        <Card className="overflow-x-hidden dark:bg-gray-800 dark:shadow-none">
            <CardBody>
                <Typography variant="h5" color="blue-gray" className="mb-2 dark:text-gray-200">
                    Useful Links
                </Typography>
                <List className="p-0 -mx-2 gap-0 min-w-0">
                    {usefulLinks.map((link) => (
                        <a key={link.url} href={link.url} target="_blank" rel="noopener noreferrer">
                            <ListItem className="rounded-none border-gray-400 border-b-[1px] hover:bg-blue-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-800">{link.name}</ListItem>
                        </a>
                    ))}
                </List>
            </CardBody>
        </Card>
    );
}

function useMetricsCard() {
    const { spsPrice, validators, lastBlock } = useMetrics();

    return [
        { label: 'SPS Price', value: `$${spsPrice?.toFixed(5) ?? '...'}` },
        { label: 'Validator Nodes', value: validators ? localeNumber(validators) : '...' },
        { label: 'Block Num', value: lastBlock?.toString() ?? '...' },
    ];
}

const MetricsCard = () => {
    const metrics = useMetricsCard();
    return (
        <Card className="flex flex-col items-center justify-around gap-6 dark:bg-gray-800 dark:shadow-none">
            <CardBody className="flex flex-col gap-4">
                {metrics.map((metric, index) => (
                    <React.Fragment key={metric.label}>
                        <div className="text-center">
                            <Typography color="blue-gray" className="text-2xl dark:text-gray-200">
                                {metric.value}
                            </Typography>
                            <Typography color="blue-gray" className="text-md dark:text-gray-200">
                                {metric.label}
                            </Typography>
                        </div>
                        {index < metrics.length - 1 && <div className="w-full h-[1px] border-gray-400 border-b-[1px] dark:text-gray-200"></div>}
                    </React.Fragment>
                ))}
            </CardBody>
        </Card>
    );
};

export type TopValidatorsTableProps = {
    limit?: number;
    active?: boolean;
};

export function TopValidatorsTable(props: TopValidatorsTableProps) {
    const [result, isLoading] = usePromise(() => DefaultService.getValidators(props.limit, undefined, undefined, props.active), [props.limit]);
    const spinnerColor = useSpinnerColor("blue");
    const containerRef = useRef<HTMLDivElement | null>(null);
    
    if (isLoading) {
        return <Spinner className="w-full dark:text-gray-500 " color={spinnerColor} />
    }
    const noValidators = result?.validators === undefined || result.validators.length === 0;
    return (
        <div className="relative">
            <div ref={containerRef} className="overflow-x-auto">
                <Table className="w-full min-w-max p-4 border-2 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-300">
                    <TableHeader columns={["Validator", "Acitve", "Missed Blocks", "Total Votes"]}/>
                    <TableBody>
                        {noValidators && (
                            <TableRow>
                                <TableCell colSpan={4}>
                                    <Typography color="blue-gray" className="text-center dark:text-gray-300">
                                        No validators registered.{' '}
                                        <Link to="/validator-nodes/manage" className="text-blue-600 underline dark:text-blue-500">
                                            Register now.
                                        </Link>
                                    </Typography>
                                </TableCell>
                            </TableRow>
                        )}
                        {!noValidators &&
                            result?.validators?.map((validator) => (
                                <TableRow key={validator.account_name} className="dark:border-gray-300">
                                    <TableCell>
                                        <ValidatorName {...validator} link_to_validator={true} />
                                    </TableCell>
                                    <TableCell>{validator.is_active ? 'Yes' : 'No'}</TableCell>
                                    <TableCell>{localeNumber(validator.missed_blocks, 0)}</TableCell>
                                    <TableCell>{localeNumber(validator.total_votes)}</TableCell>
                                </TableRow>
                            ))}
                    </TableBody>
                </Table>
            </div>
            <GradientOverflow containerRef={containerRef} isLoading={isLoading}/>
        </div>
    );
}

export type TopSpsHoldersTableProps = {
    limit?: number;
    className?: string;
};

export function TopSpsHoldersTable(props: TopSpsHoldersTableProps) {
    const [balances, isLoading] = usePromise(() => DefaultService.getBalancesByToken('SPS', props.limit), [props.limit]);
    const spinnerColor = useSpinnerColor("blue");
    const containerRef = useRef<HTMLDivElement | null>(null);
    if (isLoading) {
        return <Spinner className="w-full dark:text-gray-500 " color={spinnerColor} />
    }
    return (
        <div className="relative">
            <div ref={containerRef} className="overflow-x-auto">
                <Table className={props.className}>
                    <TableHeader columns={["Player", "Balance"]} />
                    <TableBody>
                        {balances?.balances?.map((balance, index) => (
                            <TableRow key={index} className="dark:border-gray-300">
                                <TableCell>{balance.player}</TableCell>
                                <TableCell>{localeNumber(balance.balance)}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
            <GradientOverflow containerRef={containerRef} isLoading={isLoading} />
        </div>
    );
}

export function Home() {
    return (
        <div className="grid xl:grid-cols-4 gap-6">
            <div className="grid grid-cols-4 col-span-full xl:col-span-3 gap-6 auto-rows-min">
                <Card className="col-span-full dark:bg-gray-800 dark:text-gray-300 dark:shadow-none">
                    <CardBody>
                        <Typography variant="h5" color="blue-gray" className="mb-2 dark:text-gray-200">
                            Home
                        </Typography>
                        <Typography variant="paragraph">Welcome to the homepage of the SPS Validator Network.</Typography>
                        <Typography className="mt-3" variant="paragraph">
                            Please visit the{' '}
                            <Link to="/settings" className="text-blue-600 underline dark:text-blue-500">
                                settings
                            </Link>{' '}
                            page and configure your hive account if it's your first time here.
                        </Typography>
                    </CardBody>
                </Card>

                <Card className="col-span-full dark:bg-gray-800 dark:shadow-none">
                    <CardBody>
                        <Typography variant="h5" color="blue-gray" className="mb-6 dark:text-gray-200">
                            Top Validators
                        </Typography>
                        <TopValidatorsTable limit={10} active={true} />
                    </CardBody>
                </Card>

                <Card className="col-span-full dark:bg-gray-800 dark:shadow-none">
                    <CardBody>
                        <Typography variant="h5" color="blue-gray" className="mb-6 dark:text-gray-200">
                            Top SPS Holders
                        </Typography>
                        <TopSpsHoldersTable limit={10} className="w-full border-2 p-4 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-300" />
                    </CardBody>
                </Card>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-1 col-span-full xl:col-span-1 gap-6 auto-rows-min">
                {UsefulLinksCard()}
                {MetricsCard()}
            </div>
        </div>
    );
}
