import React, { useCallback, useState } from "react";
import { Button, InputBase, Paper } from "@mui/material";
import styles from "./ApprovalInput.module.css";

type ApprovalInputProps = {
  name: JSX.Element | string;
  onRequest: (account: string) => void;
  disabled: boolean;
  endIcon?: React.ReactNode;
};

export const ApprovalInput: React.FC<ApprovalInputProps> = props => {
  const [value, setValue] = useState("");

  const handleInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setValue(e.target.value);
    },
    []
  );

  const handleRequest = useCallback(() => {
    props.onRequest(value);
  }, [props.onRequest, value]);

  const handleCancel = useCallback(() => {
    setValue("");
  }, []);

  const handleKeyUp = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (e.key === "Enter") {
        handleRequest();
      } else if (e.key === "Escape") {
        handleCancel();
      }
    },
    [handleRequest]
  );

  return (
    <Paper className={styles.button}>
      <InputBase
        className={styles.input}
        onKeyUp={handleKeyUp}
        onChange={handleInput}
        disabled={props.disabled}
      />
      <Button
        className={styles.approve}
        disabled={props.disabled}
        onClick={handleRequest}
        endIcon={props.endIcon}
      >
        {props.name}
      </Button>
    </Paper>
  );
};
