import React from 'react';

export function formatBlockTime(block_time?: string) {
    if (!block_time) {
        return 'unknown';
    }
    const date = new Date(block_time);
    const secondsAgo = Math.floor((Date.now() - date.getTime()) / 1000);
    if (secondsAgo < 60) {
        return `${secondsAgo} seconds ago`;
    }
    return date.toLocaleString();
}

export function listItemClickHandler(onClick: () => void) {
    return (event: React.MouseEvent<HTMLElement>) => {
        const target = event.target as HTMLElement;
        if (!target.classList.contains('outer-list-item')) {
            return;
        }
        onClick();
    };
}
