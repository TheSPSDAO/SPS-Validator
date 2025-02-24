import { Button, Card, CardBody, CardFooter, CardHeader, Input, Typography, Switch } from '@material-tailwind/react';
import { SunIcon, MoonIcon } from "@heroicons/react/24/solid"
import { useLocalStorage } from '../hooks';
import { OpenAPI } from '../services/openapi';
import { Hive } from '../services/hive';
import { useCallback, useState } from 'react';
import { useDarkMode } from '../context/DarkModeContext';

export function DarkModeToggle() {
    const { darkMode, toggleDarkMode } = useDarkMode();
    return (
        <div className="flex flex-row content-between">
            <Typography variant="small" className="dark:text-gray-300 mr-2">Light</Typography>
            <div className="relative h-6 w-11 flex items-center">          
                <Switch
                    id="dark-mode-toggle"
                    checked={darkMode}
                    onChange={toggleDarkMode}
                    ripple={false}
                    className="h-full w-full bg-blue-gray-50 dark:bg-gray-300"
                    containerProps={{
                    className: "w-11 h-6 flex items-center",
                    }}
                    circleProps={{
                    className: "before:hidden left-0.5 border-none bg-black dark:bg-blue-800",
                    }}
                />
                <SunIcon
                    className={`absolute left-1 w-4 h-4 text-white dark:text-gray-800 transition-opacity pointer-events-none ${
                    darkMode ? "opacity-40" : "opacity-100"
                    }`}
                />
                <MoonIcon
                    className={`absolute right-1 w-4 h-4 text-black dark:text-gray-300 transition-opacity pointer-events-none ${
                    darkMode ? "opacity-100" : "opacity-20"
                    }`}
                />
            </div>
            <Typography variant="small" className="dark:text-gray-300 ml-2">Dark</Typography>
        </div>
    );
  }


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
        Hive.PREFIX = workingPrefix;
        Hive.ACCOUNT = workingAccount;
        OpenAPI.BASE = workingApi;
    }, [workingPrefix, workingApi, workingAccount]);

    return (
        <div className="flex justify-center">
            <Card className="2xl:w-1/3 lg:w-2/3 sm:w-full dark:bg-gray-800 dark:text-gray-300 dark:shadow-none">
                <CardBody>
                    <Typography variant="h5" color="blue-gray" className="mb-2 dark:text-gray-200">
                        Settings
                    </Typography>
                    <Typography variant="paragraph" className="dark:text-gray-300">Adjust the theme for the UI.</Typography>
                    <div className="border-gray-400 border-b-[1px] my-5 pb-5">
                        <DarkModeToggle />
                    </div>
                    <Typography variant="paragraph" className="dark:text-gray-300 mt-5">Adjust the settings that the UI uses to interact with the SPS Validator Network.</Typography>
                    <form className="mt-8 flex flex-col gap-6">
                        <div>
                            <Input
                                size="lg"
                                label="Hive Prefix"
                                placeholder="Hive Transaction ID Prefix"
                                value={workingPrefix}
                                onChange={(e) => setWorkingPrefix(e.target.value.trim())}
                                className="flex-grow-1 dark:text-gray-300 dark:border-gray-300 dark:placeholder-shown:border-t-gray-300 dark:focus:border-gray-200 dark:focus:border-t-transparent dark:placeholder:text-gray-300 dark:focus:placeholder:text-gray-500 dark:border-t-transparent" 
                                labelProps={{className: "dark:peer-placeholder-shown:text-gray-300 dark:placeholder:text-gray-300 dark:text-gray-300 dark:peer-focus:text-gray-300 dark:peer-focus:before:!border-gray-200 dark:peer-focus:after:!border-gray-200 dark:before:border-gray-300 dark:after:border-gray-300"}}
                            />
                        </div>
                        <div>
                            <Input
                                size="lg"
                                label="Hive Account"
                                placeholder="Default Hive account name to use in transactions"
                                value={workingAccount}
                                onChange={(e) => setWorkingAccount(e.target.value.trim())}
                                className="flex-grow-1 dark:text-gray-300 dark:border-gray-300 dark:placeholder-shown:border-t-gray-300 dark:focus:border-gray-200 dark:focus:border-t-transparent dark:placeholder:text-gray-300 dark:focus:placeholder:text-gray-500 dark:border-t-transparent" 
                                labelProps={{className: "dark:peer-placeholder-shown:text-gray-300 dark:placeholder:text-gray-300 dark:text-gray-300 dark:peer-focus:text-gray-300 dark:peer-focus:before:!border-gray-200 dark:peer-focus:after:!border-gray-200 dark:before:border-gray-300 dark:after:border-gray-300"}}
                            />
                        </div>
                        <div>
                            <Input 
                                size="lg" 
                                label="Validator API URL" 
                                placeholder="Validator API URL" 
                                value={workingApi} 
                                onChange={(e) => setWorkingApi(e.target.value.trim())} 
                                className="flex-grow-1 dark:text-gray-300 dark:border-gray-300 dark:placeholder-shown:border-t-gray-300 dark:focus:border-gray-200 dark:focus:border-t-transparent dark:placeholder:text-gray-300 dark:focus:placeholder:text-gray-500 dark:border-t-transparent" 
                                labelProps={{className: "dark:peer-placeholder-shown:text-gray-300 dark:placeholder:text-gray-300 dark:text-gray-300 dark:peer-focus:text-gray-300 dark:peer-focus:before:!border-gray-200 dark:peer-focus:after:!border-gray-200 dark:before:border-gray-300 dark:after:border-gray-300"}}
                            />
                        </div>
                    </form>
                </CardBody>
                <CardFooter className="bg-transparent">
                    <div className="flex items-center justify-end">
                        <Button variant="filled" onClick={save} className="dark:bg-blue-800 dark:hover:bg-blue-600 dark:border-gray-300 dark:border dark:text-gray-300 dark:hover:text-gray-100 dark:shadow-none">
                            Save
                        </Button>
                    </div>
                </CardFooter>
            </Card>
        </div>
    );
}
