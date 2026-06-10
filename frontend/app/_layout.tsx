import { ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { useAppTheme } from '@/hooks/useAppTheme';
import { ChatProvider } from '@/context/ChatContext';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const { navigationTheme, appTheme } = useAppTheme();

  return (
    <ChatProvider>
      <ThemeProvider value={navigationTheme}>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="modal"
            options={{ presentation: "modal", title: "Modal" }}
          />
        </Stack>

        <StatusBar style={appTheme.mode === "dark" ? "light" : "dark"} />
      </ThemeProvider>
    </ChatProvider>
  );
}