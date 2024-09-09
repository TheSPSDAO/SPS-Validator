import React, { useCallback, useEffect, useState } from "react";
import styles from "./Register.module.css";
import { useSearchParams } from "react-router-dom";
import { DefaultService, Validator } from "../services/openapi";
import SearchBar from "../components/SearchBar";
import {
  Button,
  Checkbox,
  FormControlLabel,
  Paper,
  TextField,
} from "@mui/material";
import { useLocalStorage } from "../hooks";
import { Hive, HiveService } from "../services/hive";
import { FormattedMessage } from "react-intl";

type RegisterPanelProps = {
  account: string;
};

const RegisterPanel: React.FC<RegisterPanelProps> = props => {
  const handleRegister = useCallback(() => {
    HiveService.registerAsValidator(
      { is_active: true, post_url: null },
      props.account
    )
      .then(result => {
        console.log(
          `Result while registering as new validator: ${result.success}, ${result.message}`
        );
      })
      .catch(err => {
        console.error(`Error while registering as new validator: ${err}`);
      });
  }, [props.account]);

  return (
    <Paper className={styles.sub}>
      <FormattedMessage id="register.new" values={{ account: props.account }} />
      <Button
        variant="outlined"
        className={styles.register}
        onClick={handleRegister}
      >
        Register
      </Button>
    </Paper>
  );
};

type ModifyPanelProps = {
  account: string;
  post_url: string | null;
  is_active: boolean;
};

const ModifyPanel: React.FC<ModifyPanelProps> = props => {
  const [disabled, setDisabled] = useState(false);
  const [postUrl, setPostUrl] = useState(props.post_url);
  const [active, setActive] = useState(props.is_active);

  const handleCheckedChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setActive(e.target.checked);
    },
    []
  );

  const handlePostUrlChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setPostUrl(e.target.value);
    },
    []
  );

  const handleReset = useCallback(() => {
    setActive(props.is_active);
    setPostUrl(props.post_url);
  }, [props.post_url, props.is_active]);

  const handleSave = useCallback(() => {
    setDisabled(true);

    HiveService.registerAsValidator(
      { is_active: active, post_url: postUrl },
      props.account
    )
      .then(result => {
        console.info(
          `Result while updating validator: ${result.success}, ${result.message}`
        );
      })
      .catch(err => {
        console.error(`Error while updating validator: ${err}`);
      })
      .finally(() => {
        setDisabled(false);
      });
  }, [postUrl, active, props.account]);

  return (
    <Paper className={styles.sub}>
      <FormattedMessage
        id="register.existing"
        values={{ account: props.account }}
      />
      <TextField
        label="Post URL"
        value={postUrl}
        onChange={handlePostUrlChange}
        disabled={disabled}
      />
      <FormControlLabel
        control={<Checkbox checked={active} onChange={handleCheckedChange} />}
        label={"Active"}
        disabled={disabled}
      />
      <div className={styles.controls}>
        <Button onClick={handleReset} disabled={disabled}>
          Reset
        </Button>
        <Button onClick={handleSave} disabled={disabled}>
          Save
        </Button>
      </div>
    </Paper>
  );
};

const Register: React.FC = () => {
  /*
        We first must know what account wants to register, we can get this from a text field query, similar to the
        Votes page.
    
        Once we have this information we can check if that account exists in the database, if not then we can simply create
        a Register button which sends the new payload.
    
        If the account does exist we can allow the user to modify the parameters and then sign the transaction to update.
         */
  const [account] = useLocalStorage("hive.account", Hive.ACCOUNT);
  const [searchParams, setSearchParams] = useSearchParams([["q", account]]);
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [lookup, setLookup] = useState<string | null>(searchParams.get("q"));
  const [validator, setValidator] = useState<Validator | undefined>(undefined);

  useEffect(() => {
    if (lookup === null) {
      return;
    }

    const promise = DefaultService.getValidators();
    promise.then(x => {
      setValidator(x.find(x => x.account_name === lookup));
    });
    promise.catch(err => {
      console.error(err);
      setValidator(undefined);
    });

    return () => promise.cancel();
  }, [lookup]);

  const handleChange = useCallback((query: string) => {
    setQuery(query);
  }, []);

  const handleRequestSearch = useCallback(() => {
    setLookup(query);
    setSearchParams({ q: query });
  }, [query]);

  let child: JSX.Element | null;

  if (lookup === "" || lookup === null) {
    child = null;
  } else if (validator === undefined) {
    child = <RegisterPanel account={lookup} />;
  } else {
    child = (
      <ModifyPanel
        account={validator.account_name}
        is_active={validator.is_active}
        post_url={validator.post_url}
      />
    );
  }

  return (
    <div className={styles.container}>
      <SearchBar
        value={query}
        onChange={handleChange}
        onRequestSearch={handleRequestSearch}
      />
      {child}
    </div>
  );
};

export default Register;
