import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  DefaultService,
  TokenTransferTransactions as DTO,
} from "../services/openapi";
import SearchBar from "../components/SearchBar";
import styles from "./TokenTransfers.module.css";
import {
  Checkbox,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from "@mui/material";
import { FormattedMessage } from "react-intl";

const TokenTransfersPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") || "");
  const [transactions, setTransactions] = useState<DTO>([]);
  const [blockNum, setBlockNum] = useState<string | null>(
    searchParams.get("q")
  );

  useEffect(() => {
    const b = parseInt(blockNum ?? "0");

    if (isNaN(b)) return;

    const promise = DefaultService.getTokenTransferTransactions(b);

    promise.then(x => setTransactions(x));
    promise.catch(err => {
      console.error(err);
      setTransactions([]);
    });

    return () => promise.cancel();
  }, [blockNum]);

  const handleChange = (query: string) => {
    setQuery(query);
  };

  const handleRequestSearch = () => {
    setBlockNum(query);
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
        <Table
          sx={{ minWidth: 650 }}
          aria-label="token transfers table"
          size="small"
        >
          <TableHead>
            <TableRow>
              <TableCell>
                <FormattedMessage id="transactions.tokens.header.from" />
              </TableCell>
              <TableCell>
                <FormattedMessage id="transactions.tokens.header.to" />
              </TableCell>
              <TableCell>
                <FormattedMessage id="transactions.tokens.header.qty" />
              </TableCell>
              <TableCell>
                <FormattedMessage id="transactions.tokens.header.memo" />
              </TableCell>
              <TableCell>
                <FormattedMessage id="transactions.tokens.header.success" />
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {transactions.map(row => (
              <TableRow key={`${row.id}`}>
                <TableCell component="th" scope="row">
                  {row.from}
                </TableCell>
                <TableCell>{row.to}</TableCell>
                <TableCell>
                  {row.qty} {row.token}
                </TableCell>
                <TableCell>{row.memo}</TableCell>
                <TableCell>
                  <Checkbox checked={row.success} readOnly aria-readonly />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </div>
  );
};

export default TokenTransfersPage;
