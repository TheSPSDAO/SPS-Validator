import { Button, Card, CardBody, CardFooter, CardHeader, Input, Typography } from '@material-tailwind/react';
import { useLocalStorage } from '../hooks';
import { OpenAPI } from '../services/openapi';
import { Hive } from '../services/hive';
import { useCallback, useState } from 'react';

export function Settings() {
    const [prefix, setPrefix] = useLocalStorage('hive.prefix', Hive.PREFIX);
    const [api, setApi] = useLocalStorage('api.url', OpenAPI.BASE);
    const [account, setAccount] = useLocalStorage('hive.account', Hive.ACCOUNT ?? '');

    const [workingPrefix, setWorkingPrefix] = useState(prefix);
    const [workingApi, setWorkingApi] = useState(api);
    const [workingAccount, setWorkingAccount] = useState(account);

    const save = useCallback(() => {
        setPrefix(workingPrefix);
        setApi(workingApi);
        setAccount(workingAccount);
    }, [workingPrefix, workingApi, workingAccount]);

    return (
        <div className="flex justify-center">
            <Card className="2xl:w-1/3 lg:w-2/3 md:w-full">
                <CardBody>
                    <Typography variant="h5" color="blue-gray" className="mb-2">
                        Settings
                    </Typography>
                    <Typography variant="paragraph">Adjust the settings that the UI uses to interact with the SPS Validator Network.</Typography>
                    <form className="mt-8 flex flex-col gap-6">
                        <div>
                            <Input
                                size="lg"
                                label="Hive Prefix"
                                placeholder="Hive Transaction ID Prefix"
                                value={workingPrefix}
                                onChange={(e) => setWorkingPrefix(e.target.value.trim())}
                            />
                        </div>
                        <div>
                            <Input
                                size="lg"
                                label="Hive Account"
                                placeholder="Default Hive account name to use in transactions"
                                value={workingAccount}
                                onChange={(e) => setWorkingAccount(e.target.value.trim())}
                            />
                        </div>
                        <div>
                            <Input size="lg" label="Validator API URL" placeholder="Validator API URL" value={workingApi} onChange={(e) => setWorkingApi(e.target.value.trim())} />
                        </div>
                    </form>
                </CardBody>
                <CardFooter>
                    <div className="flex items-center justify-end">
                        <Button variant="filled" onClick={save}>
                            Save
                        </Button>
                    </div>
                </CardFooter>
            </Card>
        </div>
    );
}
