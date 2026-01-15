import { color } from '@material-tailwind/react/types/components/spinner';
import { useState, useEffect } from 'react';

export function useSpinnerColor(defaultColor: color = 'blue') {
    const [spinnerColor, setSpinnerColor] = useState<color | undefined>(() => {
        return document.documentElement.classList.contains('dark') ? defaultColor : undefined;
    });

    useEffect(() => {
        const compute = () => (document.documentElement.classList.contains('dark') ? defaultColor : undefined);

        setSpinnerColor(compute());

        const observer = new MutationObserver(() => {
            setSpinnerColor((prev) => {
                const next = compute();
                return prev === next ? prev : next;
            });
        });

        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
        return () => {
            observer.disconnect();
        };
    }, [defaultColor]);

    return spinnerColor;
}
