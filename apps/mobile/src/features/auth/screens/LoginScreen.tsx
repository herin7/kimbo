import { LogIn, UserRound } from "lucide-react-native";
import { useRouter, type Href } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { Button, Card, Screen, SurfaceGradient, Text, TextField, useKimboTheme } from "@/design-system";
import { KimboCompanion } from "@/features/kimbo/components/KimboCompanion";
import { KimboApiError } from "@/shared/api/api-client";
import { mapAppErrorToMessage } from "@/shared/errors/AppError";

import { demoAccounts } from "../auth.constants";
import { useLogin } from "../hooks/useAuth";

export function LoginScreen() {
  const router = useRouter();
  const { colors, radius, spacing } = useKimboTheme();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [email, setEmail] = useState<string>(demoAccounts[0].email);
  const [password, setPassword] = useState<string>(demoAccounts[0].password);
  const signIn = useLogin();
  const error = signIn.error instanceof KimboApiError
    ? mapAppErrorToMessage(signIn.error.appError)
    : signIn.error
      ? "Kimbo couldn't sign in right now. Check your connection and try again."
      : null;

  const chooseAccount = (index: number) => {
    const account = demoAccounts[index];
    if (!account) return;
    setSelectedIndex(index);
    setEmail(account.email);
    setPassword(account.password);
    signIn.reset();
  };

  const handleSignIn = async () => {
    try {
      await signIn.mutateAsync({ email, password });
      router.replace("/today" as Href);
    } catch {
      // The inline error keeps the reviewer in context.
    }
  };

  return (
    <Screen contentContainerStyle={{ justifyContent: "center", paddingVertical: spacing.huge }}>
      <View style={[styles.hero, { gap: spacing.lg }]}>
        <KimboCompanion framed={false} mood="happy" size={104} />
        <View style={{ flex: 1, gap: spacing.xs }}>
          <Text color="brand" variant="caption">REVIEWER ACCESS</Text>
          <Text variant="title">{"A week with Kimbo,\nready to explore."}</Text>
          <Text color="secondary" variant="bodySmall">Choose a demo profile. Its credentials and real history are already loaded for you.</Text>
        </View>
      </View>

      <View style={{ gap: spacing.sm }}>
        {demoAccounts.map((account, index) => {
          const selected = index === selectedIndex;
          return (
            <Pressable
              accessibilityLabel={`Use ${account.name}'s demo account`}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              key={account.email}
              onPress={() => chooseAccount(index)}
              style={({ pressed }) => [styles.account, { backgroundColor: selected ? colors.brandSoft : colors.surface, borderColor: selected ? colors.brand : colors.border, borderRadius: radius.lg, gap: spacing.md, opacity: pressed ? 0.78 : 1, padding: spacing.md }]}
            >
              <SurfaceGradient borderRadius={radius.lg} from={selected ? colors.brandSoft : colors.surfaceElevated} to={colors.surface} />
              <View style={[styles.avatar, { backgroundColor: selected ? colors.brand : colors.surfaceInteractive, borderRadius: radius.pill }]}>
                <UserRound color={selected ? colors.textInverse : colors.textSecondary} size={20} strokeWidth={2.1} />
              </View>
              <View style={styles.accountCopy}>
                <Text style={styles.strong} variant="bodySmall">{account.name}</Text>
                <Text color="muted" variant="caption">{account.goal} · 7 days of data</Text>
              </View>
              <View style={[styles.radio, { borderColor: selected ? colors.brand : colors.border, borderRadius: radius.pill }]}>
                {selected ? <View style={[styles.radioDot, { backgroundColor: colors.brand, borderRadius: radius.pill }]} /> : null}
              </View>
            </Pressable>
          );
        })}
      </View>

      <Card style={[styles.form, { borderColor: colors.border, borderRadius: radius.xl, gap: spacing.lg }]} variant="outlined">
        <TextField autoCapitalize="none" autoComplete="email" keyboardType="email-address" label="Email" onChangeText={setEmail} value={email} />
        <TextField autoCapitalize="none" autoComplete="current-password" label="Password" onChangeText={setPassword} secureTextEntry value={password} />
        {error ? <Text accessibilityRole="alert" color="danger" variant="bodySmall">{error}</Text> : null}
        <Button leftIcon={<LogIn color={colors.textInverse} size={19} />} loading={signIn.isPending} onPress={() => void handleSignIn()} size="lg">Enter Kimbo</Button>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: "center", flexDirection: "row" },
  account: { alignItems: "center", borderWidth: StyleSheet.hairlineWidth, flexDirection: "row", overflow: "hidden" },
  avatar: { alignItems: "center", height: 42, justifyContent: "center", width: 42 },
  accountCopy: { flex: 1 },
  radio: { alignItems: "center", borderWidth: 1.5, height: 22, justifyContent: "center", width: 22 },
  radioDot: { height: 12, width: 12 },
  form: { borderWidth: StyleSheet.hairlineWidth },
  strong: { fontFamily: "Manrope_600SemiBold" },
});
