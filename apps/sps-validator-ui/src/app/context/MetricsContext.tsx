import React, { createContext, useContext, useEffect, useState } from 'react';
import { DefaultService } from '../services/openapi/services/DefaultService';
import { usePromiseRefresh, usePromise } from '../hooks/Promise';
import { useMediaQuery } from "react-responsive";
import { useLocation } from "react-router-dom";

interface MetricsContextType {
    spsPrice?: number;
    validators?: number;
    lastBlock?: number;
}

const MetricsContext = createContext<MetricsContextType | null>(null);

export const MetricsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const location = useLocation();
    const isDesktop = useMediaQuery({ minWidth: 720 });
    const shouldFetch = isDesktop || location.pathname === "/";
    
    const fetchSPSPrice = shouldFetch ? () => DefaultService.getPriceForToken("SPS") : () => Promise.resolve(undefined);
    const fetchValidators = shouldFetch ? () => DefaultService.getValidators(0, 0) : () => Promise.resolve(undefined);
    const fetchStatus = shouldFetch ? () => DefaultService.getStatus() : () => Promise.resolve(undefined);

    const [spsPriceData] = usePromiseRefresh(fetchSPSPrice, 5000, []);
    const [validatorsData] = usePromise(fetchValidators);
    const [statusData] = usePromiseRefresh(fetchStatus, 5000, []);


    const [metrics, setMetrics] = useState<MetricsContextType>({});

    useEffect(() => {
        setMetrics({
            spsPrice: spsPriceData?.price,
            validators: validatorsData?.count,
            lastBlock: statusData?.last_block
        });
    }, [spsPriceData, validatorsData, statusData]);

    return <MetricsContext.Provider value={metrics ?? null}>{children}</MetricsContext.Provider>;
};

export const useMetrics = (): MetricsContextType => {
    const context = useContext(MetricsContext);
    if (!context) {
        throw new Error('useMetrics must be used within a MetricsProvider');
    }
    return context;
};
