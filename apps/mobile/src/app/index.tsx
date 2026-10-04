import { Redirect, type Href } from "expo-router";
import { View } from "react-native";

import { Screen, Text, useKimboTheme } from "@/design-system";
import { useOnboardingStatus } from "@/features/onboarding";
import { useAuthSession } from "@/features/auth/hooks/useAuth";

export default function BootstrapRoute() {
  const { spacing } = useKimboTheme();
  const onboarding = useOnboardingStatus();
  const auth = useAuthSession();

  if (onboarding.isPending || auth.isPending) {
    return (
      <Screen scroll={false}>
        <View style={{ flex: 1, gap: spacing.md, justifyContent: "center" }}>
          <Text variant="display">Kimbo</Text>
          <Text color="secondary">Preparing your day…</Text>
        </View>
      </Screen>
    );
  }

  // Signed-up users keep a local goal without an account; only show the welcome when neither exists.
  if (!auth.data && !onboarding.data) return <Redirect href={"/login" as Href} />;
  return <Redirect href={onboarding.data ? "/today" : "/onboarding"} />;
}
