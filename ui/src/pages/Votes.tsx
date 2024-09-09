import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import SearchBar from "../components/SearchBar";
import ValidatorVoteTable from "../components/ValidatorVoteTable";
import {
  CancelablePromise,
  DefaultService,
  ValidatorVotes,
} from "../services/openapi";
import styles from "./Votes.module.css";

type Props = {
  mode: "voter" | "validator";
};

const VotesPage: React.FC<Props> = props => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [votes, setVotes] = useState<ValidatorVotes>([]);
  const [query, setQuery] = useState(searchParams.get("q") || "");
  const [lookup, setLookup] = useState<string | null>(searchParams.get("q"));

  useEffect(() => {
    if (lookup === null) {
      return;
    }

    let promise: CancelablePromise<ValidatorVotes>;

    switch (props.mode) {
      case "voter":
        promise = DefaultService.getVotesByAccount(lookup);
        break;
      case "validator":
        promise = DefaultService.getVotesByValidator(lookup);
        break;
    }

    promise.then(x => setVotes(x));
    promise.catch(err => {
      console.error(err);
      setVotes([]);
    });

    return () => promise.cancel();
  }, [lookup]);

  const handleChange = (query: string) => {
    setQuery(query);
  };

  const handleRequestSearch = () => {
    setLookup(query);
    setSearchParams({ q: query });
  };

  return (
    <div className={styles.container}>
      <SearchBar
        value={query}
        onChange={handleChange}
        onRequestSearch={handleRequestSearch}
      />
      <ValidatorVoteTable votes={votes} />
    </div>
  );
};

export default VotesPage;
