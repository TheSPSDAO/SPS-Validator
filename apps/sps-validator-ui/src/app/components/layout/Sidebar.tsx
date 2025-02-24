import { List } from '@material-tailwind/react';
import { ReactNode } from 'react';

export type AppSidebarProps = {
    isMobileOpen?: boolean;
    children: ReactNode;
};

export function AppSidebar(props: AppSidebarProps) {
    return (
        <List
            className={`min-w-[260px] transition-transform fixed lg:flex lg:relative lg:translate-x-0 lg:top-auto shadow-md z-40 left-0 bottom-0 top-16 
                bg-white text-gray-900 dark:bg-gray-800 dark:text-gray-300 dark:shadow-none
                ${props.isMobileOpen ? 'translate-x-0 w-full' : '-translate-x-full'} 
            `}
        >
            {props.children}
        </List>
    );
}
