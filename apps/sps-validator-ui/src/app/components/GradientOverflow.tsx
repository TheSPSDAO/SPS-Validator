import { useEffect, useState } from "react";

export type GradientOverflowProps = {
    isLoading: boolean
    containerRef: React.RefObject<HTMLDivElement>;
};

export function GradientOverflow(props: GradientOverflowProps) {
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(false);
    const [tableHeight, setTableHeight] = useState(0);

    const checkScroll = (): void => {
        if (!props.containerRef.current) return;
    
        const { scrollLeft, scrollWidth, clientWidth, clientHeight } = props.containerRef.current;
        
        setCanScrollLeft(scrollLeft > 0);
        setCanScrollRight(scrollLeft < scrollWidth - clientWidth);
        setTableHeight(clientHeight);
    };
    
    useEffect(() => {
        const element = props.containerRef.current;
        if (!element) return;
        
            if (!props.isLoading) {
                requestAnimationFrame(checkScroll);
            }

        element.addEventListener("scroll", checkScroll);
        window.addEventListener("resize", checkScroll);
    
        return () => {
            element.removeEventListener("scroll", checkScroll);
            window.removeEventListener("resize", checkScroll);
        };
    }, [props.isLoading]);

    return(
        <>
            {canScrollLeft && (
                <div className="absolute top-0 left-0 w-5 sm:w-10 pointer-events-none bg-gradient-to-r from-black/50 dark:from-blue-600/50 to-transparent" style={{ height: tableHeight || '100%' }}></div>
            )}
            {canScrollRight && (
                <div className="absolute top-0 right-0 w-5 sm:w-10 pointer-events-none bg-gradient-to-l from-black/50 dark:from-blue-600/50 to-transparent" style={{ height: tableHeight || '100%' }}></div>
            )} 
        </>
    );
}