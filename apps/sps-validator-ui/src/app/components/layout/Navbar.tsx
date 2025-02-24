import { ReactNode } from 'react';
import { Navbar, Typography, IconButton } from '@material-tailwind/react';
import { Bars3Icon } from '@heroicons/react/24/solid';

export type AppNavbarTickerProps = {
    name: string;
    icon: ReactNode;
    value: string;
};

function Ticker(props: AppNavbarTickerProps) {
    return (
        <div key={props.name} className="flex items-center gap-x-1">
            {props.icon}
            <Typography>{`${props.name}: ${props.value}`}</Typography>
        </div>
    );
}

export type AppNavbarProps = {
    tickers: AppNavbarTickerProps[];
    toggleSidebar?: () => void;
};

export function AppNavbar(props: AppNavbarProps) {
    const toggleDrawer = () => {
        props.toggleSidebar?.();
    };
    return (
        <Navbar fullWidth={true} className="px-4 py-2 lg:px-8 lg:py-4 flex-grow-0 z-50 dark:bg-gray-800 dark:text-gray-300 dark:border-0 dark:shadow-none">
            <div className="flex items-center justify-between text-blue-gray-900 dark:text-gray-300">
                <div className="flex items-center gap-2">
                    <IconButton className="group lg:hidden dark:hover:bg-blue-gray-50/80 " variant="text" size="lg" onClick={toggleDrawer}>
                        <Bars3Icon className="h-8 w-8 stroke-2 dark:text-gray-300 dark:group-hover:text-gray-800" />
                    </IconButton>
                    <Typography as="a" href="#" className="mr-4 cursor-pointer py-1.5 font-medium text-lg">
                        SPS Validator Network
                    </Typography>
                </div>
                <div className="hidden md:flex gap-4 items-center">{props.tickers.map((ticker) => Ticker(ticker))}</div>
            </div>
        </Navbar>
    );
}
