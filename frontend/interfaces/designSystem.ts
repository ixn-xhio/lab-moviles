
export type ThemeMode = "light" | "dark";

export interface themeColors {
    background: string;
    textPrimary: string;
    textSecondary: string;
    primary: string;
    secondary: string;
}

export interface themeSpacing {
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
}

export interface themeRadius {
    sm: number;
    md: number;
    lg: number;
    xl: number;
    full: number;
}

export interface AppTheme {
    mode: ThemeMode;
    colors: themeColors;
    spacing: themeSpacing;
    radius: themeRadius;
}