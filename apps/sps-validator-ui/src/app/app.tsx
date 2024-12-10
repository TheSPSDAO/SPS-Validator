import { Route, Routes, Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { CurrencyDollarIcon, Square3Stack3DIcon } from '@heroicons/react/24/solid';
import { AppNavbar, AppNavbarTickerProps } from './components/layout/Navbar';
import { DefaultService } from './services/openapi';
import { usePromiseRefresh } from './hooks/Promise';
import { AppSidebar } from './components/layout/Sidebar';

function useTickers() {
    const [spsPrice] = usePromiseRefresh(() => DefaultService.getPriceForToken('SPS'), 5000, []);
    const [status] = usePromiseRefresh(() => DefaultService.getStatus(), 5000, []);
    const [tickers, setTickers] = useState<AppNavbarTickerProps[]>([]);
    useEffect(() => {
        const working: AppNavbarTickerProps[] = [];
        if (spsPrice) {
            working.push({
                name: 'SPS Price',
                icon: <CurrencyDollarIcon className="size-6" />,
                value: `$${spsPrice.price.toFixed(2)}`,
            });
        }
        if (status) {
            working.push({
                name: 'Block Num',
                icon: <Square3Stack3DIcon className="size-6" />,
                value: status.last_block.toString(),
            });
        }
        setTickers(working);
    }, [spsPrice, status]);
    return tickers;
}

export function App() {
    const tickers = useTickers();
    const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
    useEffect(() => {
        const listener = () => {
            if (window.innerWidth > 960) {
                console.log('Closing drawer');
                setMobileSidebarOpen(false);
            }
        };
        window.addEventListener('resize', listener);
        return () => window.removeEventListener('resize', listener);
    });
    return (
        <div className="h-screen w-full flex flex-col">
            <AppNavbar tickers={tickers} toggleSidebar={() => setMobileSidebarOpen((prev) => !prev)} />
            <div className="flex-grow flex relative">
                <AppSidebar isMobileOpen={mobileSidebarOpen} />
                <div className="flex-grow p-5">Hi there</div>
            </div>
        </div>
    );
}

export default App;
