import { Button } from '@material-tailwind/react';
import { Route, Routes, Link } from 'react-router-dom';
import { AppNavbar } from './components/layout/Navbar';

export function App() {
    return (
        <div>
            <AppNavbar />
            <div>
                <div>
                    <Routes></Routes>
                </div>
            </div>
        </div>
    );
}

export default App;
