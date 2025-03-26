import { useEffect, useRef, useState } from 'react';
import { HiveService } from '../services/hive';
import { Button, Card, CardBody, CardFooter, Checkbox, Input, Spinner, Typography } from '@material-tailwind/react';
import { AuthorizedAccountWrapper } from '../components/AuthorizedAccountWrapper';
import { DefaultService, Validator } from '../services/openapi';
import { usePromise } from '../hooks/Promise';
import { TxLookupService } from '../services/TxLookupService';
import { ValidatorVotesTable } from '../components/ValidatorVotesTable';
import { ValidatorStatsTable } from '../components/ValidatorStatsTable';
import { useSpinnerColor } from '../hooks/SpinnerColor'
import { InformationCircleIcon } from '@heroicons/react/24/solid';

function LoadingCard() {
    const spinnerColor = useSpinnerColor("blue")
    return (
        <div className="flex justify-center">
            <Card className="dark:bg-gray-800 dark:text-gray-300 dark:shadow-none">
                <CardBody>
                    <Typography variant="h5" color="blue-gray" className="mb-2 dark:text-gray-300">
                        Please wait
                    </Typography>
                    <div className="flex flex-col gap-4 items-center justify-center">
                        <Spinner className="w-full dark:text-gray-500 " color={spinnerColor}/>
                        <Typography variant="paragraph" className="dark:text-gray-300">Loading...</Typography>
                    </div>
                </CardBody>
            </Card>
        </div>
    );
}

function ErrorCard({ error, retry }: { error: Error; retry: () => void }) {
    return (
        <div className="flex justify-center">
            <Card className="dark:bg-gray-800 dark:text-gray-300 dark:shadow-none">
                <CardBody>
                    <Typography variant="h5" color="blue-gray" className="mb-2 dark:text-gray-300">
                        Error
                    </Typography>
                    <div className="flex flex-col items-center justify-center">
                        <Typography variant="paragraph" className="dark:text-gray-300">There was an error getting your validator node status - {error.message}</Typography>
                    </div>
                    <CardFooter>
                        <div className="flex items-center justify-end">
                            <Button onClick={retry} className="dark:bg-blue-800 dark:hover:bg-blue-600 dark:border-gray-300 dark:border dark:text-gray-300 dark:hover:text-gray-100 dark:shadow-none">Retry</Button>
                        </div>
                    </CardFooter>
                </CardBody>
            </Card>
        </div>
    );
}

interface InputField {
    label: string;
    tooltip: string;
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

interface ValidatorInputGroupProps {
    inputs: InputField[];
    disabled?: boolean;
    closeOnClick?: boolean;
}


const ValidatorInputGroup: React.FC<ValidatorInputGroupProps> = ({ inputs, disabled, closeOnClick }) => {
    const inputContainerRefs = useRef<(HTMLDivElement | null)[]>([]);
    const tooltipRefs = useRef<(HTMLDivElement | null)[]>([]);
    const [activeTooltipIndex, setActiveTooltipIndex] = useState<number | null>(null);
    const [hoverTooltipIndex, setHoverTooltipIndex] = useState<number | null>(null);

    useEffect(() => {
        const updateTooltipWidth = (index: number) => {
            const container = inputContainerRefs.current[index];
            const tooltip = tooltipRefs.current[index];
            if (container && tooltip) {
                const containerWidth = container.getBoundingClientRect().width;
                tooltip.style.width = `${containerWidth}px`;
            }
        };

        const observers = inputContainerRefs.current.map((container, index) => {
            if (container) {
                updateTooltipWidth(index);
                const observer = new ResizeObserver(() => updateTooltipWidth(index));
                observer.observe(container);
                return observer;
            }
            return null;
        });

        const handleDocumentClick = (event: MouseEvent) => {
            if (activeTooltipIndex !== null && tooltipRefs.current[activeTooltipIndex]) {
                const tooltipElement = tooltipRefs.current[activeTooltipIndex];
                if (!tooltipElement?.contains(event.target as Node)) {
                    setActiveTooltipIndex(null);
                }
            }
        };

        if (activeTooltipIndex !== null) {
            document.addEventListener('mousedown', handleDocumentClick);
        }

        return () => {
            document.removeEventListener('mousedown', handleDocumentClick);
            observers.forEach(observer => observer?.disconnect());
        };
    }, [inputs.length, activeTooltipIndex]);

    const handleMouseEnter = (index: number) => {
        setHoverTooltipIndex(index);
    };

    const handleMouseLeave = () => {
        setHoverTooltipIndex(null);
    };

    const isTouchDevice = !window.matchMedia("(hover: hover)").matches;

    const handleTooltipToggle = (index: number) => {
        if (isTouchDevice || closeOnClick) {
            setActiveTooltipIndex(prev => (prev === index ? null : index));
        } else {
            setActiveTooltipIndex(index);
        }
    };

    return (
        <div className="flex flex-col gap-4">
            {inputs.map((input, index) => (
                <div key={index} className="relative flex flex-col">
                    <div 
                        ref={el => tooltipRefs.current[index] = el}
                        className={`absolute right-0 -top-3 transform -translate-y-full z-10 transition-opacity duration-200 ${isTouchDevice ? (activeTooltipIndex === index ? 'opacity-100' : 'opacity-0 pointer-events-none') : (hoverTooltipIndex === index ? 'opacity-100' : 'opacity-0 pointer-events-none')}`}
                    >
                        <div className="relative">
                            <div className="bg-blue-gray-50 text-blue-gray-900 dark:bg-gray-600 dark:text-gray-100 p-2 rounded-xl shadow-lg dark:shadow-none text-sm">
                                {input.tooltip}
                            </div>
                            <div 
                                className="absolute -bottom-[16px] right-[26px] w-0 h-0 border-l-[16px] border-l-transparent border-r-[0px] border-r-transparent border-t-[16px] border-t-blue-gray-50 dark:border-t-gray-600"
                            />
                        </div>
                    </div>
                    <div 
                        id={`input-container-${index}`} 
                        className="relative"
                        ref={el => inputContainerRefs.current[index] = el}
                    >
                        <Input
                            size="lg"
                            label={input.label}
                            value={input.value}
                            disabled={disabled}
                            onChange={input.onChange}
                            className="pr-10 flex-grow-1 dark:text-gray-300 dark:border-gray-300 dark:border-solid dark:placeholder-shown:border-gray-300 dark:placeholder-shown:border-t-gray-300 dark:focus:border-gray-200 dark:focus:border-t-transparent dark:placeholder:text-gray-300 dark:focus:placeholder:text-gray-500 dark:border-t-transparent dark:disabled:text-gray-800"
                            labelProps={{
                                className: "dark:peer-placeholder-shown:text-gray-300 dark:placeholder:text-gray-300 dark:text-gray-300 dark:peer-focus:text-gray-300 dark:peer-focus:before:!border-gray-200 dark:peer-focus:after:!border-gray-200 dark:before:border-gray-300 dark:after:border-gray-300"
                            }}
                        />
                        <div 
                            className="absolute inset-y-0 right-2 flex items-center"
                            onMouseEnter={() => !isTouchDevice && handleMouseEnter(index)}
                            onMouseLeave={() => !isTouchDevice && handleMouseLeave()}
                            onClick={() => handleTooltipToggle(index)}
                        >
                            <div className="relative size-9 cursor-pointer">
                                <div className="absolute top-1/2 left-1/2 h-1/2 w-1/2 -translate-x-1/2 -translate-y-1/2 dark:bg-gray-300 rounded-full" />
                                <InformationCircleIcon 
                                    className="absolute inset-0 size-9 text-black dark:text-blue-800" 
                                />
                            </div>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};


function RegisterCard({ account, registered }: { account: string; registered: () => void }) {
    const [postUrl, setPostUrl] = useState('');
    const [apiUrl, setApiUrl] = useState('');
    const [rewardAccount, setRewardAccount] = useState('');
    const [error, setError] = useState('');
    const [progress, setProgress] = useState(false);
    const spinnerColor = useSpinnerColor("teal")

    const register = async () => {
        setProgress(true);
        setError('');
        try {
            const posted = await HiveService.updateValidator(
                {
                    is_active: false,
                    post_url: postUrl === '' ? null : postUrl,
                    api_url: apiUrl === '' ? null : apiUrl,
                    reward_account: rewardAccount === '' ? null : rewardAccount,
                },
                account,
            );
            if (!posted.success || posted.error) {
                throw new Error(posted.error ?? 'Failed to register validator node');
            }
            const result = await TxLookupService.waitForTx(posted.result.id);
            if (!result.success) {
                throw new Error(result.error! ?? 'Failed to register validator node');
            }
            registered();
        } catch (err) {
            console.error('Failed to register validator node', err);
            setError(err!.toString());
        } finally {
            setProgress(false);
        }
    };

    return (
        <div className="flex justify-center">
            <Card className="2xl:w-1/3 lg:w-2/3 md:w-full dark:bg-gray-800 dark:text-gray-300 dark:shadow-none">
                <CardBody>
                    <Typography variant="h5" color="blue-gray" className="mb-2 dark:text-gray-200">
                        Register Validator Node - {account}
                    </Typography>
                    <Typography variant="paragraph" className="dark:text-gray-300">
                        Register your validator node to join the network. You can install it from{' '}
                        <a href="https://github.com/TheSPSDAO/SPS-Validator" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline dark:text-blue-500">
                            here.
                        </a>
                    </Typography>
                    <form className="mt-8 flex flex-col gap-6 w-full sm:max-w-[400px]">
                    <ValidatorInputGroup
                        disabled={progress}
                        closeOnClick={true}
                        inputs={[
                            {
                                label: "API URL",
                                tooltip: "URL that your node will be accessible from (not required). Not setting this can discourage users from voting for your node.",
                                value: apiUrl,
                                onChange: (e) => setApiUrl(e.target.value.trim()),
                            },
                            {
                                label: "Post URL",
                                tooltip: "PeakD post describing why users should vote for your node (not required). Not setting this can discourage users from voting for your node.",
                                value: postUrl,
                                onChange: (e) => setPostUrl(e.target.value.trim()),
                            },
                            {
                                label: "Reward Account",
                                tooltip: "The accounts that your nodes rewards will be sent to. If not set, they will go to the nodes account.",
                                value: rewardAccount,
                                onChange: (e) => setRewardAccount(e.target.value.trim()),
                            },
                        ]}
                    />                        
                    </form>
                </CardBody>
                <CardFooter>
                    {error && (
                        <Typography variant="paragraph" color="red" className="mb-2 text-center">
                            {error}
                        </Typography>
                    )}
                    <div className="flex items-center justify-end">
                        <Button className="flex flex-row items-center dark:bg-blue-800 dark:hover:bg-blue-600 dark:border-gray-300 dark:border dark:text-gray-300 dark:hover:text-gray-100 dark:shadow-none" variant="filled" disabled={progress} onClick={register}>
                            {progress && <Spinner className="me-3 text-sm" color={spinnerColor}/>}
                            Register
                        </Button>
                    </div>
                </CardFooter>
            </Card>
        </div>
    );
}

function ManageCard({ account, validator, reloadValidator }: { account: string; validator: Validator; reloadValidator: () => void }) {
    const [isActive, setIsActive] = useState<boolean>(validator.is_active);
    const [postUrl, setPostUrl] = useState<string>(validator.post_url ?? '');
    const [apiUrl, setApiUrl] = useState<string>(validator.api_url ?? '');
    const [rewardAccount, setRewardAccount] = useState<string>(validator.reward_account ?? '');
    const [error, setError] = useState('');
    const [progress, setProgress] = useState(false);
    const spinnerColor = useSpinnerColor("teal")

    const update = async () => {
        setProgress(true);
        setError('');
        try {
            const broadcastResult = await HiveService.updateValidator(
                {
                    is_active: isActive,
                    post_url: postUrl === '' ? null : postUrl,
                    api_url: apiUrl === '' ? null : apiUrl,
                    reward_account: rewardAccount === '' ? null : rewardAccount,
                },
                account,
            );
            if (!broadcastResult.success || broadcastResult.error) {
                throw new Error(broadcastResult.error ?? 'Failed to update validator node');
            }
            const txResult = await TxLookupService.waitForTx(broadcastResult.result.id);
            if (!txResult.success) {
                throw new Error(txResult.error! ?? 'Failed to update validator node');
            }
            reloadValidator();
        } catch (err) {
            console.error('Failed to update validator node', err);
            setError(err!.toString());
        } finally {
            setProgress(false);
        }
    };

    return (
        <div className="grid 2xl:grid-cols-4 gap-6">
            <div className="grid grid-cols-4 col-span-full 2xl:col-span-3 gap-6 auto-rows-min">
                <Card className="col-span-full dark:bg-gray-800 dark:text-gray-300 dark:shadow-none">
                    <CardBody>
                        <Typography variant="h5" color="blue-gray" className="mb-2 dark:text-gray-200">
                            Validator Node Stats - {account}
                        </Typography>
                        <ValidatorStatsTable validator={validator} className="w-full mt-4" />
                    </CardBody>
                </Card>
                <Card className="col-span-full dark:bg-gray-800 dark:text-gray-300 dark:shadow-none">
                    <CardBody>
                        <Typography variant="h5" color="blue-gray" className="mb-2 dark:text-gray-200">
                            Votes On Your Validator Node - {account}
                        </Typography>
                        <ValidatorVotesTable account={account} className="w-full" />
                    </CardBody>
                </Card>
            </div>
            <div className="grid grid-cols-1 col-span-full 2xl:col-span-1 gap-6 auto-rows-min">
                <Card className="col-span-full dark:bg-gray-800 dark:text-gray-300 dark:shadow-none">
                    <CardBody>
                        <Typography variant="h5" color="blue-gray" className="mb-2 dark:text-gray-200">
                            Manage Validator Node - {account}
                        </Typography>
                        <form className="mt-8 flex flex-col gap-4">
                            <div className="-mx-3">
                                <Checkbox checked={isActive} onChange={(e) => setIsActive(e.target.checked)} label="Active" disabled={progress} className="dark:checked:bg-blue-800 dark:border-gray-300 dark:before:bg-blue-400 dark:checked:before:bg-blue-400 dark:text-gray-300" labelProps={{className: "dark:text-gray-300"}}/>
                            </div>
                            <ValidatorInputGroup
                                disabled={progress}
                                closeOnClick={true}
                                inputs={[
                                    {
                                        label: "API URL",
                                        tooltip: "URL that your node will be accessible from (not required). Not setting this can discourage users from voting for your node.",
                                        value: apiUrl,
                                        onChange: (e) => setApiUrl(e.target.value.trim()),
                                    },
                                    {
                                        label: "Post URL",
                                        tooltip: "PeakD post describing why users should vote for your node (not required). Not setting this can discourage users from voting for your node.",
                                        value: postUrl,
                                        onChange: (e) => setPostUrl(e.target.value.trim()),
                                    },
                                    {
                                        label: "Reward Account",
                                        tooltip: "The accounts that your nodes rewards will be sent to. If not set, they will go to the nodes account.",
                                        value: rewardAccount,
                                        onChange: (e) => setRewardAccount(e.target.value.trim()),
                                    },
                                ]}
                            />{' '}
                            {!isActive && (
                                <Typography variant="paragraph" color="red">
                                    You will not be able to validate blocks and receive rewards if your node is inactive.
                                </Typography>
                            )}
                        </form>
                    </CardBody>
                    <CardFooter>
                        {error && (
                            <Typography variant="paragraph" color="red" className="mb-2 text-center">
                                {error}
                            </Typography>
                        )}
                        <div className="flex items-center justify-start md:justify-end">
                            <Button className="flex flex-row items-center dark:bg-blue-800 dark:hover:bg-blue-600 dark:border-gray-300 dark:border dark:text-gray-300 dark:hover:text-gray-100 dark:shadow-none" variant="filled" disabled={progress} onClick={update}>
                                {progress && <Spinner className="me-3 text-sm" color={spinnerColor}/>}
                                Update
                            </Button>
                        </div>
                    </CardFooter>
                </Card>
            </div>
        </div>
    );
}

export function ManageValidatorNode() {
    const [account, setAccount] = useState<string | undefined>();
    const [validator, loading, error, reloadValidator] = usePromise(() => (account ? DefaultService.getValidator(account) : Promise.resolve(undefined)), [account]);
    const [step, setStep] = useState<'register' | 'registered'>('register');

    useEffect(() => {
        if (!loading && validator) {
            setStep('registered');
        } else {
            setStep('register');
        }
    }, [validator]);

    const realStep = !loading && !error ? step : undefined;

    return (
        <AuthorizedAccountWrapper title="Manage Validator Node" onAuthorized={setAccount} onAuthorizing={() => setAccount(undefined)}>
            {loading && <LoadingCard />}
            {error && <ErrorCard error={error} retry={reloadValidator} />}
            {realStep === 'register' && <RegisterCard account={account!} registered={reloadValidator} />}
            {realStep === 'registered' && <ManageCard account={account!} validator={validator!} reloadValidator={reloadValidator} />}
        </AuthorizedAccountWrapper>
    );
}
