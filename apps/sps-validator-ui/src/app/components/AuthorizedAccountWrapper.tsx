import { useEffect, useState } from 'react';
import { useLocalStorage } from '../hooks';
import { Hive, HiveService } from '../services/hive';
import { Button, Card, CardBody, CardFooter, Input, Spinner, Typography } from '@material-tailwind/react';

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
                    <Button variant="outlined" onClick={reauthorize}>
                        Switch Account ({account})
                    </Button>
                </div>
                <div>{props.children}</div>
            </div>
        );
    } else {
        return (
            <div className="flex justify-center">
                <Card className="2xl:w-1/3 lg:w-2/3 md:w-full">
                    <CardBody>
                        <Typography variant="h5" color="blue-gray" className="mb-2">
                            {props.title} - Authorize Account
                        </Typography>
                        <Typography variant="paragraph">Authorize your Hive Account to use this page.</Typography>
                        <form className="mt-8 flex flex-col gap-6">
                            <div>
                                <Input
                                    size="lg"
                                    label="Hive Account"
                                    placeholder="Hive account to authorize"
                                    value={workingAccount}
                                    onChange={(e) => setWorkingAccount(e.target.value.trim())}
                                    disabled={progress}
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
                            <Button className="flex flex-row items-center" variant="filled" disabled={!account || progress} onClick={authorize}>
                                {progress && <Spinner className="me-3 text-sm" />}
                                Authorize
                            </Button>
                        </div>
                    </CardFooter>
                </Card>
            </div>
        );
    }
}
