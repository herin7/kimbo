import {
  createContext,
  type PropsWithChildren,
  useContext,
} from "react";
import { useColorScheme } from "react-native";

import {
  colorPalettes,
  motion,
  radius,
  shadows,
  sizing,
  spacing,
  typography,
  type ColorScheme,
} from "../tokens";

const createTheme = (scheme: ColorScheme) => ({
  scheme,
  colors: colorPalettes[scheme],
  motion,
  radius,
  shadows,
  sizing,
  spacing,
  typography,
});

export type KimboTheme = ReturnType<typeof createTheme>;

const ThemeContext = createContext<KimboTheme | null>(null);

export function KimboThemeProvider({ children }: PropsWithChildren) {
  const colorScheme = useColorScheme() === "dark" ? "dark" : "light";

  return (
    <ThemeContext.Provider value={createTheme(colorScheme)}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useKimboTheme(): KimboTheme {
  const theme = useContext(ThemeContext);

  if (!theme) {
    throw new Error("useKimboTheme must be used inside KimboThemeProvider");
  }

  return theme;
}
