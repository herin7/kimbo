import { Flame, Footprints, LogOut, Mail, Target, UserRound } from "lucide-react-native";
import { useRouter, type Href } from "expo-router";
import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";

import { Button, Card, Screen, SurfaceGradient, Text, useKimboTheme } from "@/design-system";
import { useAuthSession, useLogout } from "@/features/auth/hooks/useAuth";
import { useOnboardingStatus } from "@/features/onboarding";

const goalLabels = { lose: "Lose weight", maintain: "Maintain", gain: "Gain weight" } as const;

export function ProfileScreen() {
  const router = useRouter();
  const { colors, radius, spacing } = useKimboTheme();
  const { data: session } = useAuthSession();
  const { data: goal } = useOnboardingStatus();
  const logout = useLogout();

  const handleLogout = async () => {
    await logout.mutateAsync();
    router.replace("/login" as Href);
  };

  if (!session || !goal) return null;

  return (
    <Screen contentContainerStyle={{ paddingBottom: spacing.huge * 2.5, paddingTop: spacing.huge + spacing.xxl }}>
      <View style={{ gap: spacing.xs }}>
        <Text color="secondary" variant="caption">YOUR KIMBO</Text>
        <Text variant="title">Profile</Text>
      </View>

      <Card style={[styles.identity, { borderColor: colors.border, borderRadius: radius.xl, gap: spacing.lg, padding: spacing.xl }]} variant="outlined">
        <SurfaceGradient borderRadius={radius.xl} from={colors.heroWashFrom} to={colors.heroWashTo} />
        <View style={[styles.avatar, { backgroundColor: colors.brandSoft, borderRadius: radius.pill }]}>
          <UserRound color={colors.brand} size={32} strokeWidth={2} />
        </View>
        <View style={styles.identityCopy}>
          <Text variant="heading">{session.user.name}</Text>
          <View style={[styles.inline, { gap: spacing.xs }]}>
            <Mail color={colors.textMuted} size={14} />
            <Text color="muted" variant="caption">{session.user.email}</Text>
          </View>
        </View>
      </Card>

      <View style={{ gap: spacing.sm }}>
        <Text variant="heading">Starting targets</Text>
        <ProfileRow icon={<Target color={colors.brand} size={21} />} label="Goal" value={goalLabels[goal.goalType]} />
        <ProfileRow icon={<Flame color={colors.calories} size={21} />} label="Daily energy" value={`${goal.dailyCalorieTarget.toLocaleString()} kcal`} />
        <ProfileRow icon={<Footprints color={colors.steps} size={21} />} label="Daily movement" value={`${goal.dailyStepTarget.toLocaleString()} steps`} />
      </View>

      <Card style={[styles.weightCard, { backgroundColor: colors.surfaceSunken, borderRadius: radius.lg, gap: spacing.lg }]}>
        <View>
          <Text color="muted" variant="caption">CURRENT</Text>
          <Text variant="numericMedium">{goal.currentWeightKg} kg</Text>
        </View>
        <View style={[styles.weightDivider, { backgroundColor: colors.border }]} />
        <View>
          <Text color="muted" variant="caption">TARGET</Text>
          <Text variant="numericMedium">{goal.targetWeightKg} kg</Text>
        </View>
      </Card>

      <Text color="muted" variant="caption">Targets are estimates for planning, not medical advice.</Text>
      <Button leftIcon={<LogOut color={colors.danger} size={19} />} loading={logout.isPending} onPress={() => void handleLogout()} variant="ghost">Switch demo account</Button>
    </Screen>
  );
}

function ProfileRow({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  const { colors, radius, spacing } = useKimboTheme();
  return (
    <View style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg, gap: spacing.md, padding: spacing.lg }]}>
      <View style={[styles.rowIcon, { backgroundColor: colors.surfaceElevated, borderRadius: radius.md }]}>{icon}</View>
      <Text color="secondary" style={styles.identityCopy} variant="bodySmall">{label}</Text>
      <Text style={styles.strong} variant="bodySmall">{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  identity: { alignItems: "center", flexDirection: "row", overflow: "hidden" },
  avatar: { alignItems: "center", height: 64, justifyContent: "center", width: 64 },
  identityCopy: { flex: 1 },
  inline: { alignItems: "center", flexDirection: "row" },
  row: { alignItems: "center", borderWidth: StyleSheet.hairlineWidth, flexDirection: "row" },
  rowIcon: { alignItems: "center", height: 42, justifyContent: "center", width: 42 },
  weightCard: { alignItems: "center", flexDirection: "row", justifyContent: "space-around" },
  weightDivider: { height: 44, width: StyleSheet.hairlineWidth },
  strong: { fontFamily: "Manrope_600SemiBold" },
});
