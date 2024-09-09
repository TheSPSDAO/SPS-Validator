import React, { useCallback } from "react";
import { Route, Routes, useMatch, Outlet, useNavigate } from "react-router-dom";
import styles from "./PlaygroundRoot.module.css";
import {
  Box,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  SelectChangeEvent,
} from "@mui/material";
import { Edit } from "@mui/icons-material";
import { FormattedMessage } from "react-intl";
import { PlaygroundPage, TimePage } from "./";

const routes = [
  {
    route: "/playground",
    id: "playground.freeform",
    icon: Edit,
  },
  {
    route: "/playground/time",
    id: "playground.time",
    icon: Edit,
  },
];

const PlaygroundRoot: React.FC = () => {
  let match = useMatch("/playground/:page");
  let navigate = useNavigate();

  const value = match?.pathname ?? "/playground";

  const handleSelect = useCallback((e: SelectChangeEvent) => {
    navigate(e.target.value);
  }, []);

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        margin: "auto",
        padding: "10px 0px",
      }}
    >
      <FormControl variant="standard">
        <InputLabel>Mode</InputLabel>
        <Select value={value} onChange={handleSelect}>
          {routes.map(prop => (
            <MenuItem key={prop.id} value={prop.route}>
              <FormattedMessage id={prop.id} />
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      <Outlet />
      <Routes>
        <Route path="/" element={<PlaygroundPage />} />
        <Route path="/time" element={<TimePage />} />
      </Routes>
    </Box>
  );
};

export default PlaygroundRoot;
