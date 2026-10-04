import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  useFonts,
} from "@expo-google-fonts/manrope";
import * as SplashScreen from "expo-splash-screen";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useState } from "react";

import { KimboIntro } from "@/bootstrap/KimboIntro";
import { RootProviders } from "@/bootstrap/RootProviders";
import { useKimboTheme } from "@/design-system";
import { MainNavigation, useBackFallsBackToToday } from "@/shared/navigation/MainNavigation";
import { useOnboardingStatus } from "@/features/onboarding";
import { LiveActivityCoordinator } from "@/features/activity/components/LiveActivityCoordinator";
import { KimboNudgeScheduler } from "@/features/kimbo/components/KimboNudgeScheduler";
import { KimboModePermissionGate } from "@/features/activity/components/KimboModePermissionGate";

void SplashScreen.preventAutoHideAsync();

// Tab destinations cross-fade instead of sliding, so the bottom bar never rides a slide transition.
const tabScreenOptions = { animation: "fade", animationDuration: 180, headerShown: false } as const;

function RootStack() {
  const { colors, scheme } = useKimboTheme();
  const { data: goal } = useOnboardingStatus();
  useBackFallsBackToToday(Boolean(goal));
  const [isIntroVisible, setIsIntroVisible] = useState(true);
  const hideIntro = useCallback(() => setIsIntroVisible(false), []);

  return (
    <>
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      <Stack
        screenOptions={{
          contentStyle: { backgroundColor: colors.background },
          headerShadowVisible: false,
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.textPrimary,
          headerTitleStyle: { fontFamily: "Manrope_600SemiBold" },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen name="today" options={tabScreenOptions} />
        <Stack.Screen name="progress" options={tabScreenOptions} />
        <Stack.Screen name="activity" options={tabScreenOptions} />
        <Stack.Screen
          name="meal/capture"
          options={{
            title: "Log food",
            presentation: "formSheet",
            sheetAllowedDetents: [0.5, 0.85],
            sheetCornerRadius: 28,
            sheetGrabberVisible: true,
          }}
        />
        <Stack.Screen name="meal/manual" options={{ title: "Enter meal" }} />
        <Stack.Screen name="meal/confirm" options={{ title: "Review meal", headerBackVisible: false }} />
        <Stack.Screen name="meal/voice" options={{ title: "Voice meal" }} />
        <Stack.Screen name="meal/camera" options={{ headerShown: false }} />
      </Stack>
      <LiveActivityCoordinator />
      <KimboNudgeScheduler />
      <MainNavigation />
      <KimboModePermissionGate />
      {isIntroVisible ? <KimboIntro onDone={hideIntro} /> : null}
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) void SplashScreen.hideAsync();
  }, [fontError, fontsLoaded]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <RootProviders>
      <RootStack />
    </RootProviders>
  );
}
