import { Dialog, DialogHeader, DialogBody } from "@material-tailwind/react";
import { Typography } from "@material-tailwind/react";
import { ValidatorStatsTable } from "./ValidatorStatsTable";
import { ValidatorVotesTable } from "./ValidatorVotesTable";

interface ValidatorDialogProps {
    open: boolean;
    onClose: () => void;
    selectedNode: string;
}

export const ValidatorDialog: React.FC<ValidatorDialogProps> = ({ open, onClose, selectedNode }) => {
    return (
        <Dialog className="dialog dark:bg-gray-800 dark:text-gray-300 dark:shadow-none" open={open} handler={onClose}>
            <DialogHeader>
                <Typography variant="h5" color="blue-gray" className="dark:text-gray-200">
                    Validator Node - {selectedNode}
                </Typography>
            </DialogHeader>
            <DialogBody className="dark:text-gray-300">
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
