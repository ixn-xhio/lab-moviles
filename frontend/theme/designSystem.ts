
import { AppTheme, themeColors, ThemeMode, themeRadius, themeSpacing } from '@/interfaces/designSystem'
import { Theme as NavigationTheme } from '@react-navigation/native';

export const colors = {
    light: {
        background: "#FFFFFF",
    },
    dark: {
        background: "#000000",
    }
}

export const sharedSpacing: themeSpacing = {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 18,
    xl: 24,
}

export const sharedRadius: themeRadius = {
    sm: 10,
    md: 16,
    lg: 24,
    xl: 32,
    full: 9999,
}     

export const sharedLightColors: themeColors = {
    background: "#FFFFFF",
    textPrimary: "#111111",
    textSecondary: "#4B5563",
    primary: "#16A34A",
    secondary: "#F3F4F6",
}

export const sharedDarkColors: themeColors = {
    background: "#000000",
    textPrimary: "#FFFFFF",
    textSecondary: "#9CA3AF",
    primary: "#10B981",
    secondary: "#374151",
}   

export const themes: Record<ThemeMode, AppTheme> = {
    light: {
        mode: "light",
        colors: sharedLightColors,
        spacing: sharedSpacing,
        radius: sharedRadius,
    },
    dark: {
        mode: "dark",
        colors: sharedDarkColors,
        spacing: sharedSpacing,
        radius: sharedRadius,
    }
}

export function getAppTheme(mode: ThemeMode): AppTheme {
    return themes[mode];
}

export function getNavigationTheme(mode: ThemeMode): NavigationTheme {
  const appTheme = getAppTheme(mode);

  return {
    dark: mode === "dark",
    colors: {
      primary: appTheme.colors.primary,
      background: appTheme.colors.background,
      card: appTheme.colors.background,
      text: appTheme.colors.textPrimary,
      border: "transparent",
      notification: appTheme.colors.primary,
    },
    fonts: {
      regular: {
        fontFamily: "System",
        fontWeight: "400",
      },
      medium: {
        fontFamily: "System",
        fontWeight: "500",
      },
      bold: {
        fontFamily: "System",
        fontWeight: "700",
      },
      heavy: {
        fontFamily: "System",
        fontWeight: "800",
      },
    },
  };
}



export abstract class BaseTheme implements AppTheme {
  abstract mode: ThemeMode;
  protected abstract palette: themeColors;

  spacing = sharedSpacing;
  radius = sharedRadius;

  get colors(): themeColors {
    return this.palette;
  }
}


export class LightTheme extends BaseTheme {
  mode: "light" = "light";
  protected palette = sharedLightColors;
}

export class DarkTheme extends BaseTheme {
  mode: "dark" = "dark";
  protected palette = sharedDarkColors;
}


export class ThemeFactory {
  private static instances: Record<ThemeMode, AppTheme> = {
    light: new LightTheme(),
    dark: new DarkTheme(),
  };

  static create(mode: ThemeMode): AppTheme {
    return this.instances[mode];
  }
}