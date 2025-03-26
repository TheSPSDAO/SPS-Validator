import { ArrowLeftIcon, ArrowRightIcon } from '@heroicons/react/24/solid';
import { Button, IconButton, IconButtonProps, Typography } from '@material-tailwind/react';
import { useEffect, useState } from 'react';

export type TableProps = {
    children: React.ReactNode;
    className?: string;
};

export function Table(props: TableProps) {
    return <table className={`table-auto ${props.className ?? ''}`}>{props.children}</table>;
}

export type TableHeadProps = {
    children?: React.ReactNode;
    className?: string;
};

export function TableHead(props: TableHeadProps) {
    return <thead className={`bg-gray-50 ${props.className ?? ''}`}>{props.children}</thead>;
}

export type TableRowProps = {
    children?: React.ReactNode;
    className?: string;
};

export function TableRow(props: TableRowProps) {
    return <tr className={props.className}>{props.children}</tr>;
}

export type TableColumnProps = {
    children?: React.ReactNode;
    className?: string;
};

export function TableColumn(props: TableColumnProps) {
    return <th className={`border-b border-blue-gray-100 bg-blue-gray-50 p-4 text-left ${props.className ?? ''}`}>{props.children}</th>;
}

export type TableBodyProps = {
    children?: React.ReactNode;
    className?: string;
};

export function TableBody(props: TableBodyProps) {
    return <tbody className={props.className}>{props.children}</tbody>;
}

export type TableCellProps = {
    children: React.ReactNode;
    colSpan?: number;
    className?: string;
};

export function TableCell(props: TableCellProps) {
    return (
        <td className={`border-b border-blue-gray-100 p-4 ${props.className ?? ''}`} colSpan={props.colSpan}>
            {props.children}
        </td>
    );
}

export type TablePagerProps = {
    className?: string;
    page: number;
    displayPageCount?: number;
    limit: number;
    count: number;
    onPageChange: (page: number) => void;
    onLimitChange?: (limit: number) => void;
    containerRef: React.RefObject<HTMLDivElement>;
};

export function TablePager(props: TablePagerProps) {
    const pageCount = Math.ceil(props.count / props.limit);
    if (pageCount <= 1) {
        return null;
    }

    const getItemProps = (page: number) => ({
        variant: (props.page === page ? 'filled' : 'text') as IconButtonProps['variant'],
        color: 'gray' as IconButtonProps['color'],
        onClick: () => props.onPageChange(page),
    });

    const next = () => {
        if (props.page === pageCount - 1) return;
        props.onPageChange(props.page + 1);
    };

    const prev = () => {
        if (props.page === 0) return;
        props.onPageChange(props.page - 1);
    };
    
    enum ScreenSize {
        Mobile = 'mobile',
        Tablet = 'tablet',
        Laptop = 'laptop',
        Desktop = 'desktop',
    }
    
    const getDisplayPageCount = (containerRef: React.RefObject<HTMLDivElement>): number => {
        const [screenSize, setScreenSize] = useState<ScreenSize>(ScreenSize.Laptop);
    
        useEffect(() => {
            if (!containerRef.current) return;
    
            const updateSize = () => {
                const width = containerRef.current?.clientWidth || 0;
    
                if (width <= 470) setScreenSize(ScreenSize.Mobile);
                else if (width <= 690) setScreenSize(ScreenSize.Tablet);
                else if (width <= 790) setScreenSize(ScreenSize.Laptop);
                else setScreenSize(ScreenSize.Desktop);
            };
    
            const observer = new ResizeObserver(updateSize);
            observer.observe(containerRef.current);
    
            updateSize();
    
            return () => observer.disconnect();
        }, [containerRef]);
        
        const displayPageCount = {
            mobile: 3,
            tablet: 5,
            laptop: 9,
            desktop: 11,
        }[screenSize];
        return displayPageCount;
    };

    const displayPageCount = getDisplayPageCount(props.containerRef)

    const pageNumbers = [0];
    
    const numMiddlePages = displayPageCount - 2;
    const halfMiddle = Math.floor(numMiddlePages / 2);

    let startPage = Math.max(1, props.page - halfMiddle);
    let endPage = Math.min(pageCount - 2, props.page + halfMiddle);

    if (startPage === 1) {
        endPage = Math.min(pageCount - 2, startPage + numMiddlePages - 1);
    }

    if (endPage === pageCount - 2) {
        startPage = Math.max(1, endPage - numMiddlePages + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
        pageNumbers.push(i);
    }

    pageNumbers.push(pageCount - 1);

    return (
        <div className={`flex items-center gap-4 ${props.className ?? ''}`}>
            <Button variant="text" className="flex items-center px-3 gap-2 dark:bg-blue-800 dark:hover:bg-blue-600 dark:border-gray-300 dark:border dark:text-gray-300 dark:hover:text-gray-100" onClick={prev} disabled={props.page === 0}>
                <ArrowLeftIcon strokeWidth={2} className="h-4 w-4" />
                <span className="sr-only md:not-sr-only">Previous</span>
            </Button>
            <div className="flex items-center gap-2">
                {pageNumbers.map((page) => (
                    <IconButton key={page} {...getItemProps(page)} className={`${props.page === page ? "dark:bg-blue-800 " : "dark:bg-transparent dark:hover:text-gray-100 dark:hover:bg-blue-600"}  dark:border dark:border-gray-300 dark:text-gray-300 dark:shadow-none`}>
                        {page + 1}
                    </IconButton>
                ))}
            </div>
            <Button variant="text" className="flex items-center px-3 gap-2 dark:bg-blue-800 dark:hover:bg-blue-600 dark:border-gray-300 dark:border dark:text-gray-300 dark:hover:text-gray-100" onClick={next} disabled={props.page === pageCount - 1}>
                <span className="sr-only md:not-sr-only">Next</span>
                <ArrowRightIcon strokeWidth={2} className="h-4 w-4" />
            </Button>
        </div>
    );
}

export type TableHeaderProps = {
    columns: (string | React.ReactNode)[];
}

// TokenBalanes.tsx still has it's own header, for changing the style it would need to be done there also

export const TableHeader: React.FC<TableHeaderProps> = ({ columns }) => {
    return (
        <TableHead>
            <TableRow>
                {columns.map((column, index) => (
                    <TableColumn key={index} className="dark:bg-gray-300">
                        {column && (
                            <Typography color="blue-gray" className="font-normal text-left dark:text-gray-800">
                                {column}
                            </Typography>
                        )}
                    </TableColumn>
                ))}
            </TableRow>
        </TableHead>
    );
};

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
                <div className="absolute top-0 left-0 w-5 sm:w-10 pointer-events-none bg-gradient-to-r from-black/70 to-transparent" style={{ height: tableHeight || '100%' }}></div>
            )}
            {canScrollRight && (
                <div className="absolute top-0 right-0 w-5 sm:w-10 pointer-events-none bg-gradient-to-l from-black/70 to-transparent" style={{ height: tableHeight || '100%' }}></div>
            )} 
        </>
    );
}
