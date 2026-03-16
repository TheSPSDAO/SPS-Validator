import { List } from '@material-tailwind/react';
import { forwardRef, ReactNode } from 'react';

export type AppSidebarProps = {
    isMobileOpen?: boolean;
    children: ReactNode;
};

export const AppSidebar = forwardRef<HTMLDivElement, AppSidebarProps>((props, ref) => {
    return (
        <div ref={ref} className="relative">
            <List
                className={`h-full min-w-[260px] transition-transform fixed lg:flex lg:sticky lg:translate-x-0 shadow-md z-40 left-0 bottom-0 top-16 
                    bg-white text-gray-900 dark:bg-gray-800 dark:text-gray-300 dark:shadow-none
                    ${props.isMobileOpen ? 'translate-x-0 w-full sm:w-80' : '-translate-x-full'} 
                `}
            >
                {props.children}
            </List>
        </div>
    );
});
