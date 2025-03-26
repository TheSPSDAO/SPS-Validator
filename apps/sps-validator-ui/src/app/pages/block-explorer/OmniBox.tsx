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
        <Card className={`${className} dark:bg-gray-800 dark:text-gray-300`}>
            <CardBody>
                <Typography variant="h5" color="blue-gray" className="mb-2 dark:text-gray-200">
                    Search
                </Typography>
                <Typography variant="small" color="blue-gray" className="mb-2 dark:text-gray-300">
                    Search by block number, account name, or transaction id.
                </Typography>
                <form className="flex items-center gap-4" onSubmit={(e) => search(e)}>
                    <Input 
                        value={input} 
                        onChange={(e) => setInput(e.target.value)} 
                        label="Search" 
                        placeholder="Search" 
                        className="flex-grow-1 dark:text-gray-300 dark:border-gray-300 dark:placeholder-shown:border-t-gray-300 dark:focus:border-gray-200 dark:focus:border-t-transparent dark:placeholder:text-gray-300 dark:focus:placeholder:text-gray-500 dark:border-t-transparent" 
                        labelProps={{className: "dark:peer-placeholder-shown:text-gray-300 dark:placeholder:text-gray-300 dark:text-gray-300 dark:peer-focus:text-gray-300 dark:peer-focus:before:!border-gray-200 dark:peer-focus:after:!border-gray-200 dark:before:border-gray-300 dark:after:border-gray-300"}} 
                        disabled={progress} />
                    <Button className="p-2 sm:w-32 flex flex-row items-center justify-center dark:bg-blue-800 dark:hover:bg-blue-600 dark:border-gray-300 dark:border dark:text-gray-300 dark:hover:text-gray-100 dark:shadow-none" type="submit" disabled={progress}>
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
