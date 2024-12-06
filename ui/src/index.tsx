import React from "react";
import ReactDOM from "react-dom";
import "./index.css";
import App from "./App";
import reportWebVitals from "./reportWebVitals";
import { BrowserRouter } from "react-router-dom";
import { IntlProvider } from "react-intl";
import English from "./lang/en.json";
import { OpenAPI } from "./services/openapi";
import { ThemeProvider } from "@mui/styles";
import { createTheme } from "@mui/material";
import { Hive } from "./services/hive/core/Hive";
import { getLocalStorageValue } from "./hooks";

const locale = navigator.language;
const messages = new Map([
    ["en-GB", English],
    ["en-US", English],
]);

OpenAPI.BASE = getLocalStorageValue(
    "api.url",
    process.env.VALIDATOR_API_URL || "http://localhost:3333"
);
OpenAPI.WITH_CREDENTIALS = false;
Hive.PREFIX = getLocalStorageValue(
    "hive.prefix",
    process.env.VALIDATOR_PREFIX || "sm_"
);

ReactDOM.render(
    <React.StrictMode>
        <ThemeProvider theme={createTheme()}>
            <IntlProvider
                locale={locale}
                messages={messages.get(locale) || English}
            >
                <BrowserRouter basename={process.env.REACT_APP_BASEPATH}>
                    <App />
                </BrowserRouter>
            </IntlProvider>
        </ThemeProvider>
    </React.StrictMode>,
    document.getElementById("root")
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
