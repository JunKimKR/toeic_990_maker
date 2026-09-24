import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useApp } from '../store/appStore';
import { Loading } from '../ui/components';
import { usePalette } from '../ui/theme';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function RootLayout() {
  const ready = useApp((s) => s.ready);
  const init = useApp((s) => s.init);
  const p = usePalette();

  useEffect(() => {
    init().finally(() => SplashScreen.hideAsync().catch(() => undefined));
  }, [init]);

  const base = p.dark ? DarkTheme : DefaultTheme;
  const theme = { ...base, colors: { ...base.colors, background: p.bg, card: p.surface, text: p.text, border: p.border, primary: p.accent } };

  return (
    <SafeAreaProvider>
      <ThemeProvider value={theme}>
        <StatusBar style={p.dark ? 'light' : 'dark'} />
        {!ready ? (
          <Loading label="오늘의 훈련을 준비하는 중" />
        ) : (
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: p.bg } }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="session" options={{ presentation: 'fullScreenModal', gestureEnabled: false, animation: 'slide_from_bottom' }} />
            <Stack.Screen name="result" options={{ presentation: 'card', gestureEnabled: false }} />
            <Stack.Screen name="weakness" />
            <Stack.Screen name="review" options={{ presentation: 'fullScreenModal' }} />
            <Stack.Screen name="dev" />
          </Stack>
        )}
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
