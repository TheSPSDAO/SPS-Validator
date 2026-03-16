import { InformationCircleIcon } from '@heroicons/react/24/solid';
import { Tooltip } from '@material-tailwind/react';
import React from 'react';

export type InfoTooltipProps = {
    text: string;
    className?: string;
    icon?: React.ReactNode;
};

export function InfoTooltip(props: InfoTooltipProps) {
    const icon = props.icon ?? <InformationCircleIcon className={`inline h-5 w-5 text-blue-gray-900 ${props.className}`} />;
    return (
        <Tooltip className="max-w-96 dark:bg-gray-600 dark:text-gray-100" content={props.text}>
            {icon}
        </Tooltip>
    );
}
