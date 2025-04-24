import { Card, CardBody, List, ListItem, Spinner, Tooltip, Typography, Checkbox } from '@material-tailwind/react'; // Added Checkbox
import { DefaultService, Block } from '../../services/openapi';
import React from 'react';
import { usePromiseRefresh } from '../../hooks/Promise';
import { Link, useNavigate } from 'react-router-dom';
import { OmniBox } from './OmniBox';
import { BlockTimeChip, ValidatorChip } from './Chips';
import { listItemClickHandler } from './utils';

export function BlockList({ className }: { className?: string }) {
    const [blockOffset] = React.useState<number | undefined>(undefined);
    const [limit] = React.useState(15);
    const [autoRefresh, setAutoRefresh] = React.useState(true); // Added state for auto-refresh
    const nav = useNavigate();

    const refreshInterval = autoRefresh ? 3000 : 0; // Calculate interval based on state

    const [blocks, isBlocksLoading, error] = usePromiseRefresh<Block[]>(() => DefaultService.getBlocks(limit, blockOffset), refreshInterval, [limit, blockOffset]); // Use calculated interval

    if (error) {
        return <Typography color="red">Error loading blocks: {error.message}</Typography>; // Added error display
    }
    if (isBlocksLoading && !blocks) {
        return <Spinner />;
    }
    if (blocks === null) {
        return <div>Waiting for block data</div>;
    }

    return (
        <Card className={className}>
            <CardBody>
                <div className="flex justify-between items-center mb-2"> {/* Container for title and checkbox */}
                    <Typography variant="h5" color="blue-gray">
                        Recent Blocks
                    </Typography>
                    <Checkbox
                        label="Auto-refresh"
                        checked={autoRefresh}
                        onChange={(e) => setAutoRefresh(e.target.checked)}
                        crossOrigin={undefined} // Required prop for Material Tailwind v2+
                    />
                </div>
                <List className="p-0 mt-4">
                    {blocks.map((block, i) => (
                        <React.Fragment key={block.block_num}>
                            <ListItem onClick={listItemClickHandler(() => nav(`/block-explorer/block?block=${block.block_num}`))} className="cursor-pointer outer-list-item">
                                <div>
                                    <div className="mb-2">
                                        <Typography variant="paragraph" color="blue-gray" className="font-semibold">
                                            Block{' '}
                                            <Link to={`/block-explorer/block?block=${block.block_num}`} className="font-semibold underline text-blue-gray-800">
                                                {block.block_num}
                                            </Link>
                                        </Typography>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <BlockTimeChip blockTime={block.block_time} />
                                        <ValidatorChip account={block.validator} validation_tx={block.validation_tx} />
                                    </div>
                                </div>
                            </ListItem>
                            {i !== blocks.length - 1 && <hr className="my-0 opacity-75 border-blue-gray-200" />}
                        </React.Fragment>
                    ))}
                </List>
            </CardBody>
        </Card>
    );
}

export function BlockExplorer() {
    return (
        <div className="grid grid-cols-1 place-items-center gap-4">
            <OmniBox className="2xl:w-3/4 w-full" />
            <BlockList className="2xl:w-3/4 w-full" />
        </div>
    );
}
