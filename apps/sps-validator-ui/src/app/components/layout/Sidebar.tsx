import { List } from '@material-tailwind/react';
import { ReactNode } from 'react';

export type AppSidebarProps = {
    isMobileOpen?: boolean;
    children: ReactNode;
};

export function AppSidebar(props: AppSidebarProps) {
    return (
        <List
            className={`h-screen min-w-[260px] transition-transform fixed lg:flex lg:sticky lg:translate-x-0 lg:top-[4.5rem] lg:mb-[-4.5rem] bg-white shadow-md z-40 left-0 bottom-0 top-16 ${
                props.isMobileOpen ? 'translate-x-0 w-full' : '-translate-x-full'
            }`}
        >
            {props.children}
        </List>
    );
}
