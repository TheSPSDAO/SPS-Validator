import { Card, CardBody, List, ListItem, Spinner, Tooltip, Typography } from '@material-tailwind/react';
import { DefaultService, Block } from '../../services/openapi';
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { OmniBox } from './OmniBox';
import { BlockTimeChip, ValidatorChip } from './Chips';
import { listItemClickHandler } from './utils';

export function BlockList({ className }: { className?: string }) {
    const [blockOffset] = useState<number | undefined>(undefined);
    const [limit] = useState(15);
    const [blocks, setBlocks] = useState<Block[] | undefined>(undefined);
    const [isBlocksLoading, setIsBlocksLoading] = useState(true);
    const nav = useNavigate();

    useEffect(() => {
        let isMounted = true;
        const fetchBlocks = async () => {
            try {
                const fetchedBlocks = await DefaultService.getBlocks(limit, blockOffset);
                if (isMounted) {
                    setBlocks(fetchedBlocks);
                    setIsBlocksLoading(false);
                }
            } catch (error) {
                console.error('Failed to fetch blocks:', error);
                if (isMounted) {
                    setIsBlocksLoading(false);
                }
            }
        };

        fetchBlocks();

        const intervalId = setInterval(fetchBlocks, 3000);

        return () => {
            isMounted = false;
            clearInterval(intervalId);
        };
    }, [limit, blockOffset]);

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
