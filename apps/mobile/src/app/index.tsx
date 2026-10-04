import { Redirect } from "expo-router";
import { View } from "react-native";

import { Screen, Text, useKimboTheme } from "@/design-system";
import { useOnboardingStatus } from "@/features/onboarding";

export default function BootstrapRoute() {
  const { spacing } = useKimboTheme();
  const onboarding = useOnboardingStatus();

  if (onboarding.isPending) {
    return (
      <Screen scroll={false}>
        <View style={{ flex: 1, gap: spacing.md, justifyContent: "center" }}>
          <Text variant="display">Kimbo</Text>
          <Text color="secondary">Preparing your day…</Text>
        </View>
      </Screen>
    );
  }

  return <Redirect href={onboarding.data ? "/today" : "/onboarding"} />;
}
