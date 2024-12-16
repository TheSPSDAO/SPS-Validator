import { useEffect, useState } from 'react';
import { Hive, HiveService } from '../services/hive';
import { Spinner } from '@material-tailwind/react';

type ManageStep = 'loading' | 'enterAccount' | 'manageNode';

export function ManageVotes() {
    const [step, setStep] = useState<ManageStep>('loading');
    const [account, setAccount] = useState<string>(Hive.ACCOUNT ?? '');

    useEffect(() => {
        if (!account) {
            setStep('enterAccount');
        } else {
            // check if the account is authed with keychain
            HiveService.authorize(account)
                .then((isAuthed) => {
                    if (isAuthed) {
                        setStep('manageNode');
                    } else {
                        setStep('enterAccount');
                    }
                })
                .catch(() => {
                    setStep('enterAccount');
                });
        }
    }, [account]);

    if (step === 'loading') {
        return <Spinner className="w-full" />;
    }
    return <div>Hi {step}</div>;
}
