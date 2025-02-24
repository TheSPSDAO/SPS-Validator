import { ArrowLeftIcon, ArrowRightIcon } from '@heroicons/react/24/solid';
import { Button, IconButton, IconButtonProps } from '@material-tailwind/react';
import { useMediaQuery } from "react-responsive";

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

    const isMobile = useMediaQuery({ query: '(max-width: 500px)' });
    const isTablet = useMediaQuery({ query: '(min-width: 501px) and (max-width: 750px)' });
    const isDesktop = useMediaQuery({ query: '(min-width: 751px)' });

    const screenSize = isMobile ? "mobile" : isTablet ? "tablet" : "desktop";
    

    const displayPageCount = {
        mobile: 3,
        tablet: 5,
        desktop: 7
    }[screenSize] ?? 7;

    const pageNumbers = [0]; // Always include the first page
    
    const numMiddlePages = displayPageCount - 2; // Remaining slots for middle pages
    const halfMiddle = Math.floor(numMiddlePages / 2);

    let startPage = Math.max(1, props.page - halfMiddle);
    let endPage = Math.min(pageCount - 2, props.page + halfMiddle);

    // Adjust if at the start
    if (startPage === 1) {
        endPage = Math.min(pageCount - 2, startPage + numMiddlePages - 1);
    }
    // Adjust if at the end
    if (endPage === pageCount - 2) {
        startPage = Math.max(1, endPage - numMiddlePages + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
        pageNumbers.push(i);
    }

    // Always include last page if more than 1 page
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
