import { useColorScheme } from 'react-native';
import { getAppTheme, ThemeFactory } from '@/theme/designSystem';
import { NavigationThemeAdapter } from '@/theme/navigationThemeAdapter';


export function useAppTheme() {
  const scheme = useColorScheme();
  const mode = scheme === "dark" ? "dark" : "light";

  return {
    appTheme: ThemeFactory.create(mode),
    navigationTheme: NavigationThemeAdapter.from(mode),
  };
}

export function useGetTheme() {
  const scheme = useColorScheme();
  const mode = scheme === 'dark' ? 'dark' : 'light';
  const theme = useAppTheme();
  return [scheme, theme] as const;
}