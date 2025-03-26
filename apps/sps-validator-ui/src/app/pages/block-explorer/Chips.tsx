import { BoltIcon, CalendarIcon, ShieldCheckIcon, UserCircleIcon } from '@heroicons/react/24/solid';
import { formatBlockTime } from './utils';
import { Chip, Tooltip } from '@material-tailwind/react';
import { Link } from 'react-router-dom';

export function BlockTimeChip({ blockTime, className }: { blockTime?: string; className?: string }) {
    return (
        <Tooltip content={`The block time in your local timezone (UTC: ${blockTime})`} placement="top" className="dark:bg-gray-600 dark:text-gray-100">
            <Chip variant="ghost" value={formatBlockTime(blockTime)} icon={<CalendarIcon />} className={className} />
        </Tooltip>
    );
}

export function AccountChip({ account, className }: { account: string; className?: string }) {
    return (
        <Link to={`/block-explorer/account?account=${account}`}  className={className} onClick={(event) =>{event.stopPropagation()}} >
            <Tooltip content="Account name"  className="dark:bg-gray-600 dark:text-gray-100">
                <Chip variant="outlined" value={account} icon={<UserCircleIcon />} className={className} />
            </Tooltip>
        </Link>
    );
}

export function ValidatorChip({ account, validation_tx, className}: { account?: string; validation_tx?: string; className?: string }) {
    return (
        <Link className="dark:text-gray-300" to={`/block-explorer/account?account=${account}`} onClick={(event) =>{event.stopPropagation()}} >
            <Tooltip content="The validator selected for this block" className="dark:bg-gray-600 dark:text-gray-100" >
                <Chip
                    variant="outlined"
                    color={validation_tx ? 'green' : 'gray'}
                    value={account ?? 'not assigned'}
                    icon={validation_tx ? <ShieldCheckIcon /> : <UserCircleIcon />}
                    className={` ${validation_tx ? ' dark:!text-green-400 dark:!border-green-400' : ''} ${className}
                      `}
                />
            </Tooltip>
        </Link>
    );
}

export function TxStatusChip({ success, error, className }: { success: boolean; error?: string; className?: string }) {
    return (
        <Tooltip content="Transaction status (success or error code)" className="dark:bg-gray-600 dark:text-gray-100">
            {success ? <Chip variant="gradient" color="green" value="success" className={className} /> : <Chip variant="gradient" color="red" value={`error: ${error}`}  className={className} />}
        </Tooltip>
    );
}

export function TxTypeChip({ type, className }: { type: string; className?: string }) {
    return (
        <Tooltip content="Transaction type (operation name)" className="dark:bg-gray-600 dark:text-gray-100">
            <Chip variant="ghost" value={type} icon={<BoltIcon />} className={className} />
        </Tooltip>
    );
}
