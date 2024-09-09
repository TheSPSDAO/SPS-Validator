import React, { useEffect, useState } from "react";
import { DefaultService, Status } from "../services/openapi";
import Loading from "../components/Loading";
import { FormattedDate, FormattedTime } from "react-intl";

const Home: React.FC = () => {
  const [status, setStatus] = useState<Status | null | undefined>(undefined);

  useEffect(() => {
    const promise = DefaultService.getStatus();

    promise.then(status => {
      setStatus(status);
    });

    promise.catch(err => {
      console.error(err);
      setStatus(null);
    });

    return () => promise.cancel();
  }, []);

  if (status === undefined) {
    return <Loading />;
  } else if (status === null) {
    return <div>Error while loading status</div>;
  } else {
    const blockTime = new Date(status.last_block.block_time);

    return (
      <div>
        <ul>
          <li>Status: {status.status}</li>
          <li>Block #: {status.last_block.block_num}</li>
          <li>Block ID: {status.last_block.block_id}</li>
          <li>Layer 2 Block ID: {status.last_block?.l2_block_id}</li>
          <li>
            Block Time: <FormattedDate value={blockTime} />{" "}
            <FormattedTime value={blockTime} />
          </li>
          <li>Validator TX: {status.last_block?.validator_tx}</li>
          <li>Validator: {status.last_block?.validator}</li>
        </ul>
      </div>
    );
  }
};

export default Home;
