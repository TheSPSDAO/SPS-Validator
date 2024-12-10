import { List } from '@material-tailwind/react';
import { ReactNode } from 'react';

export type AppSidebarProps = {
    isMobileOpen?: boolean;
    children: ReactNode;
};

export function AppSidebar(props: AppSidebarProps) {
    return (
        <List
            className={`transition-transform fixed lg:flex lg:relative lg:translate-x-0 lg:top-auto bg-white shadow-md z-10 left-0 bottom-0 top-16 ${
                props.isMobileOpen ? 'translate-x-0 w-full' : '-translate-x-full'
            }`}
        >
            {props.children}
        </List>
    );
}
