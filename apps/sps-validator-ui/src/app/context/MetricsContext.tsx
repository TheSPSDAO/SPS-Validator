/* eslint-disable prettier/prettier */
import React, { createContext, useContext, useEffect, useState } from 'react';
import { DefaultService } from '../services/openapi/services/DefaultService'; // Adjust the import path
import { usePromiseRefresh, usePromise } from '../hooks/Promise'; // Adjust the import path

// Define the data type for context
interface MetricsContextType {
    spsPrice?: number;
    validators?: number;
    lastBlock?: number;
}

// Create the context
const MetricsContext = createContext<MetricsContextType | undefined>(undefined);

// Context provider component
export const MetricsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [spsPriceData] = usePromiseRefresh(() => DefaultService.getPriceForToken('SPS'), 5000, []);
    const [validatorsData] = usePromise(() => DefaultService.getValidators(0, 0));
    const [statusData] = usePromiseRefresh(() => DefaultService.getStatus(), 5000, []);

    // Store shared data
    const [metrics, setMetrics] = useState<MetricsContextType>({});

    useEffect(() => {
        setMetrics({
            spsPrice: spsPriceData?.price,
            validators: validatorsData?.count,
            lastBlock: statusData?.last_block
        });
    }, [spsPriceData, validatorsData, statusData]);

    return <MetricsContext.Provider value={metrics}>{children}</MetricsContext.Provider>;
};

// Hook to use the shared context
export const useMetrics = (): MetricsContextType => {
    const context = useContext(MetricsContext);
    if (!context) {
        throw new Error('useMetrics must be used within a MetricsProvider');
    }
    return context;
};
