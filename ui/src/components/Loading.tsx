import { CircularProgress } from "@mui/material";
import React from "react";
import "./Loading.css";

const Loading: React.FC = () => {
  return (
    <div className="loading">
      <CircularProgress />
    </div>
  );
};

export default Loading;
