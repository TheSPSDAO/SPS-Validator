import React, { createContext, useContext, useEffect, useState } from "react";

interface DarkModeContextProps {
    darkMode: boolean;
    toggleDarkMode: () => void;
}

export const DarkModeContext = createContext<DarkModeContextProps | undefined>(undefined);

export const DarkModeProvider = ({ children }: { children: React.ReactNode }) => {
    const [darkMode, setDarkMode] = useState<boolean>(() => {
        const savedMode = localStorage.getItem("displayMode");
    
        if (savedMode) {
            return savedMode === "dark";
        } else {
            // If no preference, check system preference
            return window.matchMedia("(prefers-color-scheme: dark)").matches;
        }
    });

    useEffect(() => {
        if (darkMode) {
            document.documentElement.classList.add("dark");
        } else {
            document.documentElement.classList.remove("dark");
        }
        localStorage.setItem("displayMode", darkMode ? "dark" : "light");
    }, [darkMode]);

    const toggleDarkMode = () => setDarkMode((prev) => !prev);

    return (
        <DarkModeContext.Provider value={{ darkMode, toggleDarkMode }}>
            <div className={darkMode ? "dark" : ""}>{children}</div>
        </DarkModeContext.Provider>
    );
};

export const useDarkMode = () => {
    const context = useContext(DarkModeContext);
    if (!context) {
        throw new Error("useDarkMode must be used within a DarkModeProvider");
    }
    return context;
};
