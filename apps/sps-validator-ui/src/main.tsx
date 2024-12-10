import { StrictMode } from 'react';
import { BrowserRouter } from 'react-router-dom';
import * as ReactDOM from 'react-dom/client';
import { ThemeProvider } from '@material-tailwind/react';
import App from './app/app';
import { OpenAPI } from './app/services/openapi';
import { getLocalStorageValue } from './app/hooks';
import { Hive } from './app/services/hive';

OpenAPI.BASE = getLocalStorageValue('api.url', import.meta.env.VALIDATOR_API_URL || 'http://localhost:3333');
OpenAPI.WITH_CREDENTIALS = false;
Hive.PREFIX = getLocalStorageValue('hive.prefix', import.meta.env.VALIDATOR_PREFIX || 'sm_');

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);

root.render(
    <StrictMode>
        <ThemeProvider>
            <BrowserRouter>
                <App />
            </BrowserRouter>
        </ThemeProvider>
    </StrictMode>,
);
