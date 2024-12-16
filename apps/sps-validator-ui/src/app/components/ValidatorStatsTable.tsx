import { usePromise } from '../hooks/Promise';
import { DefaultService, Validator } from '../services/openapi';
import { Table, TableBody, TableCell, TableColumn, TableHead, TableRow } from './Table';

export function ValidatorStatsTable({ validator, className }: { validator: Validator | string; className?: string }) {
    const [actualValidator, loading] = usePromise(() => (typeof validator === 'string' ? DefaultService.getValidator(validator) : Promise.resolve(validator)), [validator]);
    if (loading || !actualValidator) {
        return null;
    }
    return (
        <Table className={`border-2 border-gray-200 ${className}`}>
            <TableHead>
                <TableRow>
                    <TableColumn>Field</TableColumn>
                    <TableColumn>Value</TableColumn>
                </TableRow>
            </TableHead>
            <TableBody>
                <TableRow>
                    <TableCell>Account</TableCell>
                    <TableCell>{actualValidator!.account_name}</TableCell>
                </TableRow>
                <TableRow>
                    <TableCell>Active</TableCell>
                    <TableCell>{actualValidator!.is_active ? 'Yes' : 'No'}</TableCell>
                </TableRow>
                <TableRow>
                    <TableCell>Post URL</TableCell>
                    <TableCell>{actualValidator!.post_url ? actualValidator!.post_url : 'Not Set'}</TableCell>
                </TableRow>
                <TableRow>
                    <TableCell>Missed Blocks</TableCell>
                    <TableCell>{actualValidator!.missed_blocks}</TableCell>
                </TableRow>
                <TableRow>
                    <TableCell>Total Votes</TableCell>
                    <TableCell>{actualValidator!.total_votes}</TableCell>
                </TableRow>
            </TableBody>
        </Table>
    );
}
