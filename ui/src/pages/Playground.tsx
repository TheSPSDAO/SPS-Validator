import React, { useCallback, useState } from "react";
import styles from "./Playground.module.css";
import { Hive, HiveService } from "../services/hive";
// @ts-ignore No types available for this.
import { JsonEditor } from "jsoneditor-react";
import "jsoneditor-react/es/editor.min.css";
import Ajv from "ajv";
import ace from "brace";
import "brace/mode/json";
import "brace/theme/github";
import {
  Button,
  FormControlLabel,
  FormLabel,
  Radio,
  RadioGroup,
  TextField,
} from "@mui/material";
import { Key } from "../services/hive/keychain";

const ajv = new Ajv({ allErrors: true, verbose: true });

const exampleJson = {
  type: "Test",
  quantity: 50,
  extra: 0,
  data: {
    a: "Data A",
    b: 42,
  },
  values: [0, 0],
  items: [
    {
      a: "Item A",
      b: 1,
    },
  ],
};

const Playground: React.FC = () => {
  const [actionName, setActionName] = useState(`${Hive.PREFIX}test`);
  const [signingKey, setSigningKey] = useState<Key>("Posting");
  const [payload, setPayload] = useState<object | string | number | null>(
    exampleJson
  );
  // Initial JSON we dump in is valid.
  const [validated, setValidated] = useState(true);

  const handleJsonInputChange = useCallback((e: any) => {
    setPayload(e);
  }, []);

  const handleActionNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const value = e.target.value.trim();

      setActionName(value);
    },
    []
  );

  const handleSigningKeyChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value.trim();

      if (HiveService.isSigningKey(value)) {
        setSigningKey(value);
      }
    },
    []
  );

  const handleSend = useCallback(() => {
    HiveService.requestCustomJson(
      actionName,
      signingKey,
      payload,
      "Payload from Playground"
    )
      .then(result => {
        console.log(
          `Result while sending message from Playground: ${result.success}, ${result.message}`
        );
      })
      .catch(err => {
        console.error(`Error while sending message from Playground: ${err}`);
      });
  }, [actionName, signingKey, payload]);

  return (
    <div className={styles.container}>
      <JsonEditor
        value={payload}
        onChange={handleJsonInputChange}
        allowedModes={["code"]}
        mode={"code"}
        ajv={ajv}
        ace={ace}
        htmlElementProps={{ className: styles.editor }}
      />
      <TextField
        label={"Action Name"}
        helperText={"Name of the action"}
        placeholder={"test"}
        value={actionName}
        onChange={handleActionNameChange}
      />
      <FormLabel>Hive Signing Key</FormLabel>
      <RadioGroup
        defaultValue="posting"
        value={signingKey}
        onChange={handleSigningKeyChange}
      >
        <FormControlLabel value="Active" control={<Radio />} label="Active" />
        <FormControlLabel value="Posting" control={<Radio />} label="Posting" />
        <FormControlLabel value="Memo" control={<Radio />} label="Memo" />
      </RadioGroup>
      <Button variant="outlined" onClick={handleSend} disabled={!validated}>
        Send
      </Button>
    </div>
  );
};

export default Playground;
