// ===== THEME CONTEXT =====

import React, { createContext, useContext, useEffect } from "react";
import {
  useAppSelector,
  useAppDispatch,
  selectTheme,
  setTheme,
} from "../store";

// Theme context type
interface ThemeContextType {
  isDark: boolean;
  toggleTheme: () => void;
  setLightTheme: () => void;
  setDarkTheme: () => void;
}

// Create context
const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// Theme provider component
export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const dispatch = useAppDispatch();
  const theme = useAppSelector(selectTheme);
  const isDark = theme.mode === "dark";

  // Apply theme to document
  useEffect(() => {
    const root = document.documentElement;

    if (isDark) {
      root.classList.add("dark");
      document.body.style.backgroundColor = "#111827";
      document.body.style.color = "#f3f4f6";
    } else {
      root.classList.remove("dark");
      document.body.style.backgroundColor = "#ffffff";
      document.body.style.color = "#1f2937";
    }
  }, [isDark]);

  // Theme actions
  const toggleTheme = () => {
    dispatch(setTheme(isDark ? "light" : "dark"));
  };

  const setLightTheme = () => {
    dispatch(setTheme("light"));
  };

  const setDarkTheme = () => {
    dispatch(setTheme("dark"));
  };

  const value: ThemeContextType = {
    isDark,
    toggleTheme,
    setLightTheme,
    setDarkTheme,
  };

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
};

// Custom hook để sử dụng theme context
export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);

  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }

  return context;
};

export default ThemeProvider;
