import { Card, CardBody, Typography, Input, Button, Spinner } from '@material-tailwind/react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DefaultService } from '../../services/openapi';
import { MagnifyingGlassIcon } from '@heroicons/react/24/solid';

export function OmniBox({ className }: { className?: string }) {
    const navigate = useNavigate();
    const [error, setError] = useState('');
    const [progress, setProgress] = useState(false);
    const [input, setInput] = useState('');
    const search = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setProgress(true);
        setError('');

        const trimmed = input.trim();
        try {
            if (!trimmed) {
                setError('Please enter a search term.');
                setProgress(false);
                return;
            }

            // check for block number (check if it only contains numbers)
            const onlyNumbers = /^\d+$/.test(trimmed);
            const maybeBlock = parseInt(trimmed, 10);
            if (onlyNumbers && !isNaN(maybeBlock)) {
                // navigate to block
                navigate(`/block-explorer/block?block=${maybeBlock}`);
                return;
            }

            // check for account name
            try {
                const account = await DefaultService.getAccount(trimmed);
                if (account) {
                    navigate(`/block-explorer/account?account=${account.name}`);
                }
                return;
            } catch (e) {
                // account not found
            }

            // check for transaction id
            try {
                const trx = await DefaultService.getTransaction(trimmed);
                if (trx) {
                    navigate(`/block-explorer/transaction?id=${trx.id}`);
                }
                return;
            } catch (e) {
                // transaction not found
            }

            // not found
            setError('Could not find anything that matches that search term.');
        } finally {
            setProgress(false);
        }
    };
    return (
        <Card className={className}>
            <CardBody>
                <Typography variant="h5" color="blue-gray" className="mb-2">
                    Search
                </Typography>
                <Typography variant="small" color="blue-gray" className="mb-2">
                    Search by block number, account name, or transaction id.
                </Typography>
                <form className="flex items-center gap-4" onSubmit={(e) => search(e)}>
                    <Input value={input} onChange={(e) => setInput(e.target.value)} label="Search" placeholder="Search" className="flex-grow-1" disabled={progress} />
                    <Button className="p-2 sm:w-32 flex flex-row items-center justify-center" type="submit" disabled={progress}>
                        <MagnifyingGlassIcon className="sm:hidden size-6"/>
                        <span className={`sr-only sm:not-sr-only ${progress ? 'me-2' : ''}`}>Search</span>
                        {progress && <Spinner width={16} height={16} />}
                    </Button>
                </form>
                {error && (
                    <Typography variant="small" color="red" className="mt-2">
                        {error}
                    </Typography>
                )}
            </CardBody>
        </Card>
    );
}
