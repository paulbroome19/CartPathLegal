import { Fraunces_500Medium } from '@expo-google-fonts/fraunces/500Medium';
import { Fraunces_600SemiBold } from '@expo-google-fonts/fraunces/600SemiBold';
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import 'react-native-reanimated';

import CartLoader from '@/components/CartLoader';

SplashScreen.preventAutoHideAsync();

const MIN_LOADER_MS = 1500;

export default function RootLayout() {
  const [loaded, error] = useFonts({
    Fraunces_500Medium,
    Fraunces_600SemiBold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  // Minimum display time so the loader is visible even when fonts are pre-registered.
  // The timer always fires; it cannot block the app indefinitely.
  useEffect(() => {
    const t = setTimeout(() => setMinTimeElapsed(true), MIN_LOADER_MS);
    return () => clearTimeout(t);
  }, []);

  // Hide the native splash as soon as fonts are ready so CartLoader is visible underneath.
  useEffect(() => {
    if (loaded) SplashScreen.hideAsync();
  }, [loaded]);

  if (!loaded || !minTimeElapsed) return <CartLoader />;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="course/[id]" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="about" options={{ animation: 'slide_from_right' }} />
    </Stack>
  );
}
