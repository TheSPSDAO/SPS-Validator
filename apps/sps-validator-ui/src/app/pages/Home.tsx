import { Card, CardBody, List, ListItem, Typography } from '@material-tailwind/react';
import { Link } from 'react-router-dom';
import { usePromise } from '../hooks/Promise';
import { DefaultService } from '../services/openapi';
import { useEffect, useState } from 'react';

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
                    {usefulLinks.map((link, index) => (
                        <Link key={index} to={link.url}>
                            <ListItem className="rounded-none border-gray-400 border-b-[1px]">{link.name}</ListItem>
                        </Link>
                    ))}
                </List>
            </CardBody>
        </Card>
    );
}

function MetricsCard() {
    const [spsPrice] = usePromise(() => DefaultService.getPriceForToken('SPS'));
    // TODO switch to count endpoint
    const [validators] = usePromise(() => DefaultService.getValidators());
    const [status] = usePromise(() => DefaultService.getStatus());

    const [metrics, setMetrics] = useState<{ label: string; value: string }[]>([]);
    useEffect(() => {
        setMetrics([
            { label: 'SPS Price', value: `$${spsPrice?.price ?? '...'}` },
            { label: 'Validator Nodes', value: validators?.length.toString() ?? '...' },
            { label: 'Block Num', value: status?.last_block?.toString() ?? '...' },
        ]);
    }, [spsPrice, validators, status]);

    return (
        <Card>
            <CardBody className="flex flex-col items-center justify-around gap-6">
                {metrics.map((metric, index) => (
                    <>
                        <div key={metric.label} className="text-center">
                            <Typography color="blue-gray" className="text-2xl">
                                {metric.value}
                            </Typography>
                            <Typography color="blue-gray" className="text-md">
                                {metric.label}
                            </Typography>
                        </div>
                        {index < metrics.length - 1 && <div className="w-full h-[1px] border-gray-400 border-b-[1px]"></div>}
                    </>
                ))}
            </CardBody>
        </Card>
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
                            Before you use the UI, visit the{' '}
                            <Link to="/settings" className="text-blue-600 underline">
                                settings
                            </Link>{' '}
                            page and configure your hive account.
                        </Typography>
                    </CardBody>
                </Card>

                <Card className="col-span-full">
                    <CardBody>
                        <Typography variant="h5" color="blue-gray" className="mb-2">
                            Top Validators
                        </Typography>
                    </CardBody>
                </Card>

                <Card className="col-span-full">
                    <CardBody>
                        <Typography variant="h5" color="blue-gray" className="mb-2">
                            Top SPS Holders
                        </Typography>
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
