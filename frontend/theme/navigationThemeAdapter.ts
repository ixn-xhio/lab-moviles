// navigation.theme.adapter.ts
import { Theme as NavigationTheme } from "@react-navigation/native";
import { ThemeMode } from "./designSystem";
import { ThemeFactory } from "./designSystem";

export class NavigationThemeAdapter {
  static from(mode: ThemeMode): NavigationTheme {
    const theme = ThemeFactory.create(mode);

    return {
      dark: mode === "dark",
      colors: {
        primary: theme.colors.primary,
        background: theme.colors.background,
        card: theme.colors.background,
        text: theme.colors.textPrimary,
        border: "transparent",
        notification: theme.colors.primary,
      },
      fonts: {
        regular: { fontFamily: "System", fontWeight: "400" },
        medium: { fontFamily: "System", fontWeight: "500" },
        bold: { fontFamily: "System", fontWeight: "700" },
        heavy: { fontFamily: "System", fontWeight: "800" },
      },
    };
  }
}