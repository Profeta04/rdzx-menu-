import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import { type ThemeProviderProps } from "next-themes/dist/types";

// [E-02] Admin é dark-only por design — forçar tema escuro previne UI quebrada
// caso o toggle (legado) seja acionado acidentalmente.
export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider forcedTheme="dark" defaultTheme="dark" {...props}>
      {children}
    </NextThemesProvider>
  );
}
