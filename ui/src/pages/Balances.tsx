import React, { useEffect, useState } from "react";
import { DefaultService, Balances as BalancesDTO } from "../services/openapi";
import {
  Table,
  TableContainer,
  TableRow,
  TableHead,
  TableCell,
  TableBody,
} from "@mui/material";
import { FormattedMessage } from "react-intl";
import SearchBar from "../components/SearchBar";
import styles from "./Balances.module.css";
import { useSearchParams } from "react-router-dom";

const BalancesPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") || "");
  const [balances, setBalances] = useState<BalancesDTO>([]);
  const [account, setAccount] = useState<string | null>(searchParams.get("q"));

  useEffect(() => {
    if (account === null) {
      return;
    }

    console.log(account);
    const promise = DefaultService.getBalances(account);

    promise.then(x => setBalances(x));
    promise.catch(err => {
      console.error(err);
      setBalances([]);
    });

    return () => promise.cancel();
  }, [account]);

  const handleChange = (query: string) => {
    setQuery(query);
  };

  const handleRequestSearch = () => {
    setAccount(query);
    setSearchParams({ q: query });
  };

  return (
    <div className={styles.container}>
      <SearchBar
        value={query}
        onChange={handleChange}
        onRequestSearch={handleRequestSearch}
      />
      <TableContainer>
        <Table sx={{ minWidth: 650 }} aria-label="balances table" size="small">
          <TableHead>
            <TableRow>
              <TableCell>
                <FormattedMessage id="balances.header.account" />
              </TableCell>
              <TableCell align="right">
                <FormattedMessage id="balances.header.balance" />
              </TableCell>
              <TableCell align="right">
                <FormattedMessage id="balances.header.token" />
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {balances.map(row => (
              <TableRow key={`${row.player}-${row.token}`}>
                <TableCell component="th" scope="row">
                  {row.player}
                </TableCell>
                <TableCell align="right">{row.balance}</TableCell>
                <TableCell align="right">{row.token}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </div>
  );
};

export default BalancesPage;
