import React, { useEffect, useState } from "react";
import {
  DefaultService,
  Validators as ValidatorsDTO,
} from "../services/openapi";
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
import styles from "./Validators.module.css";

const ValidatorsPage: React.FC = () => {
  const [validators, setValidators] = useState<ValidatorsDTO>([]);

  useEffect(() => {
    const promise = DefaultService.getValidators();

    promise.then(x => setValidators(x));
    promise.catch(err => {
      console.error(err);
      setValidators([]);
    });

    return () => promise.cancel();
  }, []);

  return (
    <div className={styles.container}>
      <FormattedMessage
        id="validators.count"
        values={{ count: validators.length }}
      />
      <TableContainer>
        <Table
          sx={{ minWidth: 650 }}
          aria-label="validators table"
          size="small"
        >
          <TableHead>
            <TableRow>
              <TableCell>
                <FormattedMessage id="validators.header.active" />
              </TableCell>
              <TableCell>
                <FormattedMessage id="validators.header.account" />
              </TableCell>
              <TableCell sx={{ minWidth: 300 }}>
                <FormattedMessage id="validators.header.url" />
              </TableCell>
              <TableCell>
                <FormattedMessage id="validators.header.votes" />
              </TableCell>
              <TableCell>
                <FormattedMessage id="validators.header.missed" />
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {validators.map(row => (
              <TableRow key={`${row.account_name}`}>
                <TableCell padding="checkbox">
                  <Checkbox checked={row.is_active} readOnly aria-readonly />
                </TableCell>
                <TableCell component="th" scope="row">
                  {row.account_name}
                </TableCell>
                <TableCell>{row.post_url}</TableCell>
                <TableCell>{row.total_votes}</TableCell>
                <TableCell>{row.missed_blocks}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </div>
  );
};

export default ValidatorsPage;
