import React, { useCallback, useState } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Theme,
} from "@mui/material";
import {
  ThumbDownAlt as DisapproveIcon,
  ThumbUpAlt as ApproveIcon,
} from "@mui/icons-material";
import { Close as CloseIcon } from "@mui/icons-material";
import styles from "./Approval.module.css";
import { HiveService } from "../services/hive";
import { FormattedMessage, useIntl } from "react-intl";
import {
  CustomJsonErrorResult,
  CustomJsonSuccessResult,
} from "../services/hive/keychain";
import { ApprovalInput } from "../components/ApprovalInput";

type DialogProps = {
  title: JSX.Element | string;
  message: JSX.Element | string;
};

const Approval: React.FC = () => {
  const [disabled, setDisabled] = useState(false);
  const [dialog, setDialog] = useState<DialogProps | null>(null);
  const intl = useIntl();

  const handleApprovalResult = (
    promise: Promise<CustomJsonSuccessResult | CustomJsonErrorResult>
  ) => {
    setDisabled(true);

    promise
      .then(result => {
        if (result.success) {
          setDialog({
            title: <FormattedMessage id="approval.success" />,
            message: result.message,
          });
        } else {
          setDialog({
            title: <FormattedMessage id="approval.failure" />,
            message: result.message,
          });
        }
      })
      .catch(err => {
        setDialog({
          title: <FormattedMessage id="approval.error" />,
          message:
            err.message ?? "Unknown error, see console for more details.",
        });

        console.error(`Error while submitting approval transaction: ${err}`);
      })
      .finally(() => {
        setDisabled(false);
      });
  };

  const handleApprove = (account: string) => {
    const msg = intl.formatMessage({ id: "approval.approve.msg" }, { account });

    handleApprovalResult(
      HiveService.approveValidator({ account_name: account }, msg)
    );
  };

  const handleDisapprove = (account: string) => {
    const msg = intl.formatMessage(
      { id: "approval.disapprove.msg" },
      { account }
    );

    handleApprovalResult(
      HiveService.disapproveValidator({ account_name: account }, msg)
    );
  };

  const handleClose = useCallback(() => {
    setDialog(null);
  }, []);

  return (
    <div className={styles.container}>
      <ApprovalInput
        name={<FormattedMessage id="approval.approve" />}
        onRequest={handleApprove}
        disabled={disabled}
        endIcon={<ApproveIcon />}
      />
      <ApprovalInput
        name={<FormattedMessage id="approval.disapprove" />}
        onRequest={handleDisapprove}
        disabled={disabled}
        endIcon={<DisapproveIcon />}
      />
      <Dialog open={dialog !== null}>
        <DialogTitle>
          {dialog?.title ? dialog.title : null}
          <IconButton
            aria-label="close"
            onClick={handleClose}
            sx={{
              position: "absolute",
              right: 8,
              top: 8,
              color: (theme: Theme) => theme.palette.grey[500],
            }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>{dialog?.message || null}</DialogContent>
        <DialogActions>
          <Button autoFocus onClick={handleClose}>
            <FormattedMessage id="approval.ok" />
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};

export default Approval;
