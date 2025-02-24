import { useEffect, useState } from 'react';
import { useLocalStorage } from '../hooks';
import { Hive, HiveService } from '../services/hive';
import { Button, Card, CardBody, CardFooter, Input, Spinner, Typography } from '@material-tailwind/react';
import useSpinnerColor from '../hooks/SpinnerColor';

export type AuthorizedAccountWrapperProps = {
    title: string;
    children: React.ReactNode;
    onAuthorizing: () => void;
    onAuthorized: (account?: string) => void;
};

export function AuthorizedAccountWrapper(props: AuthorizedAccountWrapperProps) {
    const [authorizedAccount, setAuthorizedAccount] = useLocalStorage('hive.authorizedAccount', '');
    const [account, setAccount] = useLocalStorage('hive.account', Hive.ACCOUNT ?? '');
    const [authorized, setAuthorized] = useState(false);
    const [workingAccount, setWorkingAccount] = useState(account);
    const [error, setError] = useState('');
    const [progress, setProgress] = useState(false);
    const spinnerColor = useSpinnerColor("teal")

    useEffect(() => {
        props.onAuthorized(authorized ? account : undefined);
    }, [authorized, authorizedAccount, account, props]);

    useEffect(() => {
        if (authorizedAccount && account && authorizedAccount === account) {
            setAuthorized(true);
        } else {
            setAuthorized(false);
        }
    }, [account, authorizedAccount]);

    const reauthorize = () => {
        setAuthorizedAccount('');
    };

    const authorize = async () => {
        setError('');
        setProgress(true);
        try {
            const isValid = await HiveService.authorize(workingAccount);
            if (isValid) {
                Hive.ACCOUNT = workingAccount;
                setAccount(workingAccount);
                setAuthorizedAccount(workingAccount);
            } else {
                setError('Authorization failed.');
            }
        } catch (e) {
            console.error('Failed to authorize hive account', e);
            setError('Authorization failed.');
        } finally {
            setProgress(false);
        }
    };

    if (authorized) {
        return (
            <div className="flex flex-col gap-4">
                <div className="flex justify-end">
                    <Button variant="outlined" onClick={reauthorize} className="dark:bg-blue-800 dark:hover:bg-blue-600 dark:border-gray-300 dark:border dark:text-gray-300 dark:hover:text-gray-100 dark:shadow-none">
                        Switch Account ({account})
                    </Button>
                </div>
                <div>{props.children}</div>
            </div>
        );
    } else {
        return (
            <div className="flex justify-center">
                <Card className="2xl:w-2/5 md:w-2/3 sm:w-full dark:bg-gray-800 dark:text-gray-300 dark:shadow-none">
                    <CardBody>
                        <Typography variant="h5" color="blue-gray" className="mb-2 dark:text-gray-200">
                            {props.title} - Authorize Account
                        </Typography>
                        <Typography variant="paragraph">Authorize your Hive Account to use this page.</Typography>
                        <form className="mt-8 gap-6 max-w-[400px]">
                            <div>
                                <Input
                                    size="lg"
                                    label="Hive Account"
                                    placeholder="Hive account to authorize"
                                    value={workingAccount}
                                    onChange={(e) => setWorkingAccount(e.target.value.trim())}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            authorize();
                                        }
                                    }}
                                    disabled={progress}
                                    className="dark:text-gray-300 dark:border-gray-300 dark:placeholder-shown:border-t-gray-300 dark:focus:border-gray-200 dark:focus:border-t-transparent dark:placeholder:text-gray-300 dark:focus:placeholder:text-gray-500 dark:border-t-transparent dark:disabled:text-gray-800" 
                                    labelProps={{className: "dark:peer-placeholder-shown:text-gray-300 dark:placeholder:text-gray-300 dark:text-gray-300 dark:peer-focus:text-gray-300 dark:peer-focus:before:!border-gray-200 dark:peer-focus:after:!border-gray-200 dark:before:border-gray-300 dark:after:border-gray-300"}}
                                />
                            </div>
                        </form>
                    </CardBody>
                    <CardFooter>
                        {error && (
                            <Typography variant="paragraph" color="red" className="mb-2 text-center">
                                {error}
                            </Typography>
                        )}
                        <div className="flex items-center justify-end">
                            <Button className="flex flex-row items-center dark:bg-blue-800 dark:hover:bg-blue-600 dark:border-gray-300 dark:border dark:text-gray-300 dark:hover:text-gray-100 dark:shadow-none" variant="filled" disabled={!workingAccount || progress} onClick={authorize}>
                                {progress && <Spinner className="me-3 text-sm dark:border-gray-300 dark:border-t-transparent" color={spinnerColor}/>}
                                Authorize
                            </Button>
                        </div>
                    </CardFooter>
                </Card>
            </div>
        );
    }
}
