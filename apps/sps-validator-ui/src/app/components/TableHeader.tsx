import { Typography } from "@material-tailwind/react";
import { TableColumn, TableHead, TableRow } from "./Table";

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