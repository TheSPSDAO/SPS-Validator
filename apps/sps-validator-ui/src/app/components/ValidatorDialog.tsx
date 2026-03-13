import { Dialog, DialogHeader, DialogBody, IconButton, Typography } from '@material-tailwind/react';
import { XMarkIcon } from '@heroicons/react/24/solid';
import { ValidatorStatsTable } from './ValidatorStatsTable';
import { ValidatorVotesTable } from './ValidatorVotesTable';

interface ValidatorDialogProps {
    open: boolean;
    onClose: () => void;
    selectedNode: string;
}

export const ValidatorDialog: React.FC<ValidatorDialogProps> = ({ open, onClose, selectedNode }) => {
    return (
        <Dialog className="dialog flex max-h-[calc(100vh-2rem)] flex-col overflow-hidden dark:bg-gray-800 dark:text-gray-300 dark:shadow-none" open={open} handler={onClose}>
            <DialogHeader className="justify-between gap-4">
                <Typography variant="h5" color="blue-gray" className="dark:text-gray-200">
                    Validator Node - {selectedNode}
                </Typography>
                <IconButton
                    variant="text"
                    onClick={onClose}
                    aria-label="Close validator dialog"
                    className="shrink-0 dark:text-gray-300 dark:hover:bg-gray-300 dark:hover:text-gray-800"
                >
                    <XMarkIcon className="h-6 w-6" />
                </IconButton>
            </DialogHeader>
            <DialogBody className="overflow-y-auto dark:text-gray-300">
                <div className="grid grid-cols-1 gap-4">
                    <div>
                        <Typography variant="h6" color="blue-gray" className="dark:text-gray-200 mb-3">
                            Stats
                        </Typography>
                        <ValidatorStatsTable validator={selectedNode} className="w-full dark:text-gray-300" />
                    </div>
                    <div>
                        <Typography variant="h6" color="blue-gray" className="dark:text-gray-200 mb-3">
                            Votes
                        </Typography>
                        <ValidatorVotesTable account={selectedNode} className="w-full dark:text-gray-300" />
                    </div>
                </div>
            </DialogBody>
        </Dialog>
    );
};
