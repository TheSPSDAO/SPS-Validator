import { Card, CardBody, List, ListItem, Spinner, Tooltip, Typography } from '@material-tailwind/react';
import { DefaultService } from '../../services/openapi';
import React, { useState } from 'react';
import { usePromise } from '../../hooks/Promise';
import { Link, useNavigate } from 'react-router-dom';
import { OmniBox } from './OmniBox';
import { BlockTimeChip, ValidatorChip } from './Chips';
import { listItemClickHandler } from './utils';

export function BlockList({ className }: { className?: string }) {
    const [blockOffset] = useState(undefined);
    const [limit] = useState(15);
    const [blocks, isBlocksLoading] = usePromise(() => DefaultService.getBlocks(limit, blockOffset), [limit, blockOffset]);
    const nav = useNavigate();

    if (isBlocksLoading) {
        return <Spinner />;
    }
    if (!blocks || blocks.length === 0) {
        return <div>No blocks found</div>;
    }

    return (
        <Card className={className}>
            <CardBody>
                <Typography variant="h5" color="blue-gray" className="mb-2">
                    Recent Blocks
                </Typography>
                <List className="p-0 mt-4">
                    {blocks.map((block, i) => (
                        <React.Fragment key={block.block_num}>
                            <ListItem onClick={listItemClickHandler(() => nav(`/block-explorer/block?block=${block.block_num}`))} className="cursor-pointer outer-list-item px-0 py-2 sm:p-3">
                                <div className="flex flex-row flex-wrap gap-2 w-full" onClick={() => {window.location.href = `/block-explorer/block?block=${block.block_num}`;;}} style={{ cursor: 'pointer' }}>
                                    <Typography variant="paragraph" color="blue-gray" className="font-semibold">
                                        Block{' '}
                                        <Link to={`/block-explorer/block?block=${block.block_num}`} className="font-semibold underline text-blue-gray-800">
                                            {block.block_num}
                                        </Link>
                                    </Typography>
                                    <div className="sm:basis-full sm:h-0"></div>
                                    <BlockTimeChip blockTime={block.block_time} />
                                    <div className="basis-full h-0 sm:hidden"></div>
                                    <ValidatorChip className="w-min" account={block.validator} validation_tx={block.validation_tx} />
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
