import React from "react";
import {
  Drawer,
  Box,
  List,
  ListItem,
  ListItemText,
  CssBaseline,
  ListItemIcon,
} from "@mui/material";
import {
  Mail as MailIcon,
  Settings as SettingsIcon,
  AppRegistration as RegisterIcon,
  ThumbsUpDown as ApproveIcon,
  HowToVote as VotesIcon,
  Poll as ValidatorsListIcon,
  HowToReg as ValidatorsIcon,
  AccountBalance as BalancesIcon,
  SwapHorizSharp as TransferIcon,
  Info as HomeIcon,
  Animation as PlaygroundIcon,
} from "@mui/icons-material";
import { Link, Routes, Route } from "react-router-dom";
import { FormattedMessage } from "react-intl";
import {
  HomePage,
  BalancesPage,
  ValidatorsPage,
  VotesPage,
  TokenTransfersPage,
  PlaygroundRootPage,
} from "./pages";
import Approval from "./pages/Approval";
import Settings from "./pages/Settings";
import Register from "./pages/Register";
import { useLocalStorage } from "./hooks";
import { Hive } from "./services/hive/core/Hive";

const routes = [
  {
    route: "/",
    id: "nav.home",
    icon: HomeIcon,
  },
  {
    route: "/balances",
    id: "nav.balances",
    icon: BalancesIcon,
  },
  {
    route: "/token_transfers",
    id: "nav.token_transfers",
    icon: TransferIcon,
  },
  {
    route: "/validators",
    id: "nav.validators",
    icon: ValidatorsIcon,
  },
  {
    route: "/votes/voter",
    id: "nav.votes.voter",
    icon: VotesIcon,
  },
  {
    route: "/votes/validator",
    id: "nav.votes.validator",
    icon: ValidatorsListIcon,
  },
  {
    route: "/validator/approval",
    id: "nav.approval",
    icon: ApproveIcon,
  },
  {
    route: "/register",
    id: "nav.register",
    icon: RegisterIcon,
  },
  {
    route: "/playground",
    id: "nav.playground",
    icon: PlaygroundIcon,
  },
  {
    route: "/settings",
    id: "nav.settings",
    icon: SettingsIcon,
  },
];

/**
 * App component
 * @constructor
 */
export default function App() {
  return (
    <Box sx={{ display: "flex" }}>
      <CssBaseline />
      <Drawer
        variant="permanent"
        anchor="left"
        sx={{
          width: 240,
          flexShrink: 0,
          "& .MuiDrawer-paper": {
            width: 240,
            boxSizing: "border-box",
          },
        }}
      >
        <List>
          {routes.map(prop => (
            <ListItem button key={prop.id} component={Link} to={prop.route}>
              <ListItemIcon>
                <prop.icon />
              </ListItemIcon>
              <ListItemText primary={<FormattedMessage id={prop.id} />} />
            </ListItem>
          ))}
        </List>
      </Drawer>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/balances" element={<BalancesPage />} />
        <Route path="/token_transfers" element={<TokenTransfersPage />} />
        <Route path="/validators" element={<ValidatorsPage />} />
        <Route path="/votes/voter" element={<VotesPage mode="voter" />} />
        <Route
          path="/votes/validator"
          element={<VotesPage mode="validator" />}
        />
        <Route path="/validator/approval" element={<Approval />} />
        <Route path="/register" element={<Register />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/playground/*" element={<PlaygroundRootPage />} />
      </Routes>
    </Box>
  );
}
