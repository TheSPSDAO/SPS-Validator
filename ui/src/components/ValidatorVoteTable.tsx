import React from "react";
import { ValidatorVotes as ValidatorVotesDTO } from "../services/openapi";
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from "@mui/material";
import { FormattedMessage } from "react-intl";

type Props = {
  votes: ValidatorVotesDTO;
};

const ValidatorVoteTable: React.FC<Props> = props => (
  <TableContainer className="container">
    <Table sx={{ minWidth: 650 }} aria-label="votes table" size="small">
      <TableHead>
        <TableRow>
          <TableCell>
            <FormattedMessage id="votes.header.voter" />
          </TableCell>
          <TableCell>
            <FormattedMessage id="votes.header.validator" />
          </TableCell>
          <TableCell>
            <FormattedMessage id="votes.header.weight" />
          </TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {props.votes.map(row => (
          <TableRow key={`${row.voter}_${row.validator}`}>
            <TableCell>{row.voter}</TableCell>
            <TableCell>{row.validator}</TableCell>
            <TableCell>{row.vote_weight}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </TableContainer>
);

export default ValidatorVoteTable;
