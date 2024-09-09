import React, { useCallback } from "react";
import { TextField } from "@mui/material";
import styles from "./Settings.module.css";
import { useLocalStorage } from "../hooks";
import { Hive } from "../services/hive";
import { OpenAPI } from "../services/openapi";

const Settings: React.FC = () => {
  const [prefix, setPrefix] = useLocalStorage("hive.prefix", Hive.PREFIX);
  const [api, setApi] = useLocalStorage("api.url", OpenAPI.BASE);
  const [account, setAccount] = useLocalStorage("hive.account", Hive.ACCOUNT);

  const handlePrefixChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const value = e.target.value.trim();

      setPrefix(value);
      Hive.PREFIX = value;
    },
    []
  );

  const handleApiChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const value = e.target.value.trim();

      setApi(value);
      OpenAPI.BASE = value;
    },
    []
  );

  const handleAccountChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const value = e.target.value.trim();

      setAccount(value);
      Hive.ACCOUNT = value;
    },
    []
  );

  return (
    <div className={styles.container}>
      <TextField
        label="Hive Prefix"
        helperText="Hive transaction ID prefix"
        value={prefix}
        onChange={handlePrefixChange}
      />
      <TextField
        label="Hive Account"
        helperText="Default Hive account name to use in transactions"
        value={account}
        onChange={handleAccountChange}
      />
      <TextField
        label="API Url"
        helperText="Validator API URL"
        value={api}
        onChange={handleApiChange}
      />
    </div>
  );
};

export default Settings;
