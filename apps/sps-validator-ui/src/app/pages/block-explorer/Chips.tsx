import { BoltIcon, CalendarIcon, ShieldCheckIcon, UserCircleIcon } from '@heroicons/react/24/solid';
import { formatBlockTime } from './utils';
import { Chip, Tooltip } from '@material-tailwind/react';
import { Link } from 'react-router-dom';

export function BlockTimeChip({ blockTime }: { blockTime?: string }) {
    return (
        <Tooltip content={`The block time in your local timezone (UTC: ${blockTime})`} placement="top">
            <Chip variant="ghost" value={formatBlockTime(blockTime)} icon={<CalendarIcon />} />
        </Tooltip>
    );
}

export function AccountChip({ account }: { account: string }) {
    return (
        <Link to={`/block-explorer/account?account=${account}`}>
            <Tooltip content="Account name">
                <Chip variant="outlined" value={account} icon={<UserCircleIcon />} />
            </Tooltip>
        </Link>
    );
}

export function ValidatorChip({ account, validation_tx }: { account?: string; validation_tx?: string }) {
    return (
        <Link to={`/block-explorer/account?account=${account}`}>
            <Tooltip content="The validator selected for this block">
                <Chip
                    variant="outlined"
                    color={validation_tx ? 'green' : 'gray'}
                    value={account ?? 'not assigned'}
                    icon={validation_tx ? <ShieldCheckIcon /> : <UserCircleIcon />}
                />
            </Tooltip>
        </Link>
    );
}

export function TxStatusChip({ success, error }: { success: boolean; error?: string }) {
    return (
        <Tooltip content="Transaction status (success or error code)">
            {success ? <Chip variant="gradient" color="green" value="success" /> : <Chip variant="gradient" color="red" value={`error: ${error}`} />}
        </Tooltip>
    );
}

export function TxTypeChip({ type }: { type: string }) {
    return (
        <Tooltip content="Transaction type (operation name)">
            <Chip variant="ghost" value={type} icon={<BoltIcon />} />
        </Tooltip>
    );
}
