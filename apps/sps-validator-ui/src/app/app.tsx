import { Link, Route, Routes } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import {
    CurrencyDollarIcon,
    HomeIcon,
    Square3Stack3DIcon,
    ServerStackIcon,
    WrenchScrewdriverIcon,
    CogIcon,
    UserIcon,
    ChartBarIcon,
    EnvelopeIcon,
    PencilSquareIcon,
    CubeIcon,
} from '@heroicons/react/24/solid';
import { ListItem, ListItemPrefix } from '@material-tailwind/react';
import { AppNavbar, AppNavbarTickerProps } from './components/layout/Navbar';
import { AppSidebar } from './components/layout/Sidebar';
import { Home } from './pages/Home';
import { Settings } from './pages/Settings';
import { TokenBalances } from './pages/TokenBalances';
import { AccountBalances } from './pages/AccountBalances';
import { ValidatorNodes } from './pages/ValidatorNodes';
import { AccountVotes } from './pages/AccountVotes';
import { ManageValidatorNode } from './pages/ManageValidatorNode';
import { ManageVotes } from './pages/ManageVotes';
import { MetricsProvider } from './context/MetricsContext';
import { useMetrics } from './context/MetricsContext';
import { BlockExplorer } from './pages/block-explorer/BlockExplorer';
import { Block } from './pages/block-explorer/Block';
import { Transaction } from './pages/block-explorer/Transaction';
import { Account } from './pages/block-explorer/Account';
import { DarkModeProvider } from './context/DarkModeContext';
import { useMediaQuery } from "react-responsive";

function AppRoutes() {
    return (
        <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/validator-nodes" element={<ValidatorNodes />} />
            <Route path="/validator-nodes/manage" element={<ManageValidatorNode />} />
            <Route path="/token-balances" element={<TokenBalances />} />
            <Route path="/account-balances" element={<AccountBalances />} />
            <Route path="/account-votes" element={<AccountVotes />} />
            <Route path="/account-votes/manage" element={<ManageVotes />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/block-explorer" element={<BlockExplorer />} />
            <Route path="/block-explorer/block" element={<Block />} />
            <Route path="/block-explorer/transaction" element={<Transaction />} />
            <Route path="/block-explorer/account" element={<Account />} />
        </Routes>
    );
}

function AppSidebarItems({ closeSidebar }: { closeSidebar: () => void }) {
    return (
        <div className="h-full">
            <Link to="/" onClick={closeSidebar}>
                <ListItem>
                    <ListItemPrefix>
                        <HomeIcon className="h-5 w-5" />
                    </ListItemPrefix>
                    Home
                </ListItem>
            </Link>
            <Link to="/block-explorer" onClick={closeSidebar}>
                <ListItem>
                    <ListItemPrefix>
                        <CubeIcon className="h-5 w-5" />
                    </ListItemPrefix>
                    Block Explorer
                </ListItem>
            </Link>
            <Link to="/validator-nodes" onClick={closeSidebar}>
                <ListItem>
                    <ListItemPrefix>
                        <ServerStackIcon className="h-5 w-5" />
                    </ListItemPrefix>
                    Validator Nodes
                </ListItem>
            </Link>
            <Link to="/validator-nodes/manage" onClick={closeSidebar}>
                <ListItem>
                    <ListItemPrefix>
                        <WrenchScrewdriverIcon className="h-5 w-5" />
                    </ListItemPrefix>
                    Manage Validator Node
                </ListItem>
            </Link>
            <Link to="/account-votes" onClick={closeSidebar}>
                <ListItem>
                    <ListItemPrefix>
                        <EnvelopeIcon className="h-5 w-5" />
                    </ListItemPrefix>
                    Account Votes
                </ListItem>
            </Link>
            <Link to="/account-votes/manage" onClick={closeSidebar}>
                <ListItem>
                    <ListItemPrefix>
                        <PencilSquareIcon className="h-5 w-5" />
                    </ListItemPrefix>
                    Manage Votes
                </ListItem>
            </Link>
            <Link to="/token-balances" onClick={closeSidebar}>
                <ListItem>
                    <ListItemPrefix>
                        <ChartBarIcon className="h-5 w-5" />
                    </ListItemPrefix>
                    Token Balances
                </ListItem>
            </Link>
            <Link to="/account-balances" onClick={closeSidebar}>
                <ListItem>
                    <ListItemPrefix>
                        <UserIcon className="h-5 w-5" />
                    </ListItemPrefix>
                    Account Balances
                </ListItem>
            </Link>
            <Link to="/settings" onClick={closeSidebar}>
                <ListItem>
                    <ListItemPrefix>
                        <CogIcon className="h-5 w-5" />
                    </ListItemPrefix>
                    Site Settings
                </ListItem>
            </Link>
        </div>
    );
}

function useTickers() {
    const { spsPrice, lastBlock } = useMetrics(); // Get shared state

    const tickers: AppNavbarTickerProps[] = [];
    if (spsPrice) {
        tickers.push({
            name: 'SPS Price',
            icon: <CurrencyDollarIcon className="size-6" />,
            value: `$${spsPrice.toFixed(5)}`,
        });
    }
    if (lastBlock) {
        tickers.push({
            name: 'Block Num',
            icon: <Square3Stack3DIcon className="size-6" />,
            value: lastBlock.toString(),
        });
    }
    return tickers;
}

export function App() {
    const isDesktop = useMediaQuery({ minWidth: 961 });
    const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
    
    useEffect(() => {
        if (isDesktop) {
        setMobileSidebarOpen(false);
        }
    }, [isDesktop]);
    
    return (
        <DarkModeProvider>
            <MetricsProvider>
                <AppContent mobileSidebarOpen={mobileSidebarOpen} setMobileSidebarOpen={setMobileSidebarOpen}/>
            </MetricsProvider>
        </DarkModeProvider>
    );
}

function AppContent({ mobileSidebarOpen, setMobileSidebarOpen}: { mobileSidebarOpen: boolean, setMobileSidebarOpen: React.Dispatch<React.SetStateAction<boolean>> }) {
    const tickers = useTickers();
    const sidebarRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const toggleButtonRef = useRef<HTMLButtonElement>(null);
    const overlayRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (
                sidebarRef.current &&
                !sidebarRef.current.contains(event.target as Node) &&
                !toggleButtonRef.current?.contains(event.target as Node)
            ) {
                setMobileSidebarOpen(false);
            }
        }

        function handleOverlayClick(event: MouseEvent) {
            if (mobileSidebarOpen) {
                handleClickOutside(event);
            }
        }
        
        if (mobileSidebarOpen && overlayRef.current) {
            overlayRef.current.addEventListener('mousedown', handleOverlayClick);
        }

        return () => {
            if (overlayRef.current) {
                overlayRef.current.removeEventListener('mousedown', handleOverlayClick);
            }
        };
    }, [mobileSidebarOpen, setMobileSidebarOpen]);


    return (
        <div ref={contentRef} className="h-screen w-full flex flex-col overflow-x-auto">
            <AppNavbar 
                tickers={tickers} 
                toggleSidebar={(event) => {
                    event.stopPropagation();
                    setMobileSidebarOpen((prev) => !prev);
                }}
                toggleButtonRef={toggleButtonRef}
                 
            />
            <div className="flex-grow flex relative dark:bg-gray-900">
                <AppSidebar ref={sidebarRef} isMobileOpen={mobileSidebarOpen}>
                    <AppSidebarItems closeSidebar={() => setMobileSidebarOpen(false)} />
                </AppSidebar>
                <div className="flex-grow pt-5 sm:p-5 w-full">
                    <div ref={overlayRef} className={`fixed inset-0 z-30 ${mobileSidebarOpen ? 'block' : 'hidden'}`} />
                    <AppRoutes />
                </div>
            </div>
        </div>
    );
}

export default App;
