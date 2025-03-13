import { Card, CardBody, List, ListItem, Spinner, Typography } from '@material-tailwind/react';
import { Link } from 'react-router-dom';
import { usePromise } from '../hooks/Promise';
import { DefaultService } from '../services/openapi';
import React from 'react';
import { Table, TableHead, TableRow, TableColumn, TableBody, TableCell } from '../components/Table';
import { useMetrics } from '../context/MetricsContext';
import { ValidatorName } from '../components/ValidatorName';
import { localeNumber } from '../components/LocaleNumber';

const usefulLinks = [
    { name: 'Splinterlands', url: 'https://splinterlands.com' },
    { name: 'SPS Whitepaper', url: 'https://sps.splinterlands.com/' },
    { name: 'SPS DAO', url: 'https://sps.splinterlands.com/dao' },
];
function UsefulLinksCard() {
    return (
        <Card>
            <CardBody className="overflow-x-hidden">
                <Typography variant="h5" color="blue-gray" className="mb-2">
                    Useful Links
                </Typography>
                <List className="p-0 -mx-2 gap-0 min-w-0">
                    {usefulLinks.map((link) => (
                        <a key={link.url} href={link.url} target="_blank" rel="noopener noreferrer">
                            <ListItem className="rounded-none border-gray-400 border-b-[1px]">{link.name}</ListItem>
                        </a>
                    ))}
                </List>
            </CardBody>
        </Card>
    );
}

function useMetricsCard() {
    const { spsPrice, validators, lastBlock } = useMetrics(); // Get shared state

    return [
        { label: 'SPS Price', value: `$${spsPrice?.toFixed(5) ?? '...'}` },
        { label: 'Validator Nodes', value: validators ? localeNumber(validators) : '...' },
        { label: 'Block Num', value: lastBlock?.toString() ?? '...' },
    ];
}

const MetricsCard = () => {
    const metrics = useMetricsCard();
    return (
        <Card>
            <CardBody className="flex flex-col items-center justify-around gap-6">
                {metrics.map((metric, index) => (
                    <React.Fragment key={metric.label}>
                        <div className="text-center">
                            <Typography color="blue-gray" className="text-2xl">
                                {metric.value}
                            </Typography>
                            <Typography color="blue-gray" className="text-md">
                                {metric.label}
                            </Typography>
                        </div>
                        {index < metrics.length - 1 && <div className="w-full h-[1px] border-gray-400 border-b-[1px]"></div>}
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
    if (isLoading) {
        return <Spinner className="w-full" />;
    }
    const noValidators = result?.validators === undefined || result.validators.length === 0;
    return (
        <Table className="w-full mt-5 border-2 border-gray-200">
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
                                No validators registered.{' '}
                                <Link to="/validator-nodes/manage" className="text-blue-600 underline">
                                    Register now.
                                </Link>
                            </Typography>
                        </TableCell>
                    </TableRow>
                )}
                {!noValidators &&
                    result?.validators?.map((validator) => (
                        <TableRow key={validator.account_name}>
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
    );
}

export type TopSpsHoldersTableProps = {
    limit?: number;
    className?: string;
};

export function TopSpsHoldersTable(props: TopSpsHoldersTableProps) {
    const [balances, isLoading] = usePromise(() => DefaultService.getExtendedBalancesByToken('SPS_TOTAL', props.limit), [props.limit]);
    if (isLoading) {
        return <Spinner className="w-full" />;
    }
    return (
        <Table className={props.className}>
            <TableHead>
                <TableRow>
                    <TableColumn>
                        <Typography color="blue-gray" className="font-normal text-left">
                            Player
                        </Typography>
                    </TableColumn>
                    <TableColumn>
                        <Typography color="blue-gray" className="font-normal text-left">
                            Balance
                        </Typography>
                    </TableColumn>
                </TableRow>
            </TableHead>
            <TableBody>
                {balances?.balances?.map((balance, index) => (
                    <TableRow key={index}>
                        <TableCell>{balance.player}</TableCell>
                        <TableCell>{localeNumber(balance.balance)}</TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    );
}

export function Home() {
    return (
        <div className="grid xl:grid-cols-4 gap-6">
            <div className="grid grid-cols-4 col-span-full xl:col-span-3 gap-6 auto-rows-min">
                <Card className="col-span-full">
                    <CardBody>
                        <Typography variant="h5" color="blue-gray" className="mb-2">
                            Home
                        </Typography>
                        <Typography variant="paragraph">Welcome to the homepage of the SPS Validator Network.</Typography>
                        <Typography className="mt-3" variant="paragraph">
                            Please visit the{' '}
                            <Link to="/settings" className="text-blue-600 underline">
                                settings
                            </Link>{' '}
                            page and configure your hive account if it's your first time here.
                        </Typography>
                    </CardBody>
                </Card>

                <Card className="col-span-full">
                    <CardBody>
                        <Typography variant="h5" color="blue-gray" className="mb-2">
                            Top Validators
                        </Typography>
                        <TopValidatorsTable limit={10} active={true} />
                    </CardBody>
                </Card>

                <Card className="col-span-full">
                    <CardBody>
                        <Typography variant="h5" color="blue-gray" className="mb-2">
                            Top SPS Holders (liquid + staked)
                        </Typography>
                        <TopSpsHoldersTable limit={10} className="w-full mt-5 border-2 border-gray-200" />
                    </CardBody>
                </Card>
            </div>
            <div className="grid grid-cols-1 col-span-full xl:col-span-1 gap-6 auto-rows-min">
                {UsefulLinksCard()}
                {MetricsCard()}
            </div>
        </div>
    );
}
