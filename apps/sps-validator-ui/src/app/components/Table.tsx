import { ArrowLeftIcon, ArrowRightIcon } from '@heroicons/react/24/solid';
import { Button, IconButton, IconButtonProps } from '@material-tailwind/react';

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

    // always show first and last page, and the current page +/- 2
    const displayPageCount = props.displayPageCount ?? 4;
    const pageNumbers = [0];
    const startPage = Math.max(1, props.page - displayPageCount);
    const endPage = Math.min(pageCount - 1, startPage + displayPageCount * 2);
    for (let i = startPage; i <= endPage; i++) {
        pageNumbers.push(i);
    }
    if (endPage < pageCount - 1) {
        pageNumbers.push(pageCount - 1);
    }

    return (
        <div className={`flex items-center gap-4 ${props.className ?? ''}`}>
            <Button variant="text" className="flex items-center gap-2" onClick={prev} disabled={props.page === 0}>
                <ArrowLeftIcon strokeWidth={2} className="h-4 w-4" /> Previous
            </Button>
            <div className="flex items-center gap-2">
                {pageNumbers.map((page) => (
                    <IconButton key={page} {...getItemProps(page)}>
                        {page + 1}
                    </IconButton>
                ))}
            </div>
            <Button variant="text" className="flex items-center gap-2" onClick={next} disabled={props.page === pageCount - 1}>
                Next
                <ArrowRightIcon strokeWidth={2} className="h-4 w-4" />
            </Button>
        </div>
    );
}
