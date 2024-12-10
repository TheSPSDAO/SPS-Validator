import { Cog6ToothIcon, InboxIcon, PowerIcon, PresentationChartBarIcon, ShoppingBagIcon, UserCircleIcon } from '@heroicons/react/24/solid';
import { Chip, List, ListItem, ListItemPrefix, ListItemSuffix } from '@material-tailwind/react';

export type AppSidebarProps = {
    isMobileOpen?: boolean;
};

export function AppSidebar(props: AppSidebarProps) {
    return (
        <List
            className={`transition-transform fixed lg:flex lg:relative lg:translate-x-0 lg:top-auto bg-white shadow-md z-10 left-0 bottom-0 top-16 ${
                props.isMobileOpen ? 'translate-x-0 w-full' : '-translate-x-full'
            }`}
        >
            <ListItem>
                <ListItemPrefix>
                    <PresentationChartBarIcon className="h-5 w-5" />
                </ListItemPrefix>
                Dashboard
            </ListItem>
            <ListItem>
                <ListItemPrefix>
                    <ShoppingBagIcon className="h-5 w-5" />
                </ListItemPrefix>
                E-Commerce
            </ListItem>
            <ListItem>
                <ListItemPrefix>
                    <InboxIcon className="h-5 w-5" />
                </ListItemPrefix>
                Inbox
                <ListItemSuffix>
                    <Chip value="14" size="sm" variant="ghost" color="blue-gray" className="rounded-full" />
                </ListItemSuffix>
            </ListItem>
            <ListItem>
                <ListItemPrefix>
                    <UserCircleIcon className="h-5 w-5" />
                </ListItemPrefix>
                Profile
            </ListItem>
            <ListItem>
                <ListItemPrefix>
                    <Cog6ToothIcon className="h-5 w-5" />
                </ListItemPrefix>
                Settings
            </ListItem>
            <ListItem>
                <ListItemPrefix>
                    <PowerIcon className="h-5 w-5" />
                </ListItemPrefix>
                Log Out
            </ListItem>
        </List>
    );
}
