import * as Haptics from "expo-haptics";
import Storage from "expo-sqlite/kv-store";
import { KimboCompanion } from "@/features/kimbo/components/KimboCompanion";
import { useEffect, useRef, useState } from "react";
import { Modal, StyleSheet, View } from "react-native";

import { Button, Card, Text, useKimboTheme } from "@/design-system";
import { kimboMode, useKimboMode } from "@/features/kimbo/kimbo-mode.store";
import { useOnboardingStatus } from "@/features/onboarding";

const NEVER_ASK_KEY = "kimbo.mode.overlay.never-ask.v1";

export function KimboModePermissionGate() {
  const { colors, radius, spacing } = useKimboTheme();
  const { data: goal } = useOnboardingStatus();
  const [isVisible, setIsVisible] = useState(false);
  const [isOpeningSettings, setIsOpeningSettings] = useState(false);
  const checkedThisLaunch = useRef(false);

  const { hasPermission, isAvailable } = useKimboMode();

  // Ask once per launch, after onboarding, only while display access is missing.
  useEffect(() => {
    if (!isAvailable || !goal || hasPermission || checkedThisLaunch.current) return;
    checkedThisLaunch.current = true;
    void Storage.getItem(NEVER_ASK_KEY).then((choice) => {
      if (choice !== "true") setIsVisible(true);
    });
  }, [goal, hasPermission, isAvailable]);

  if (!isAvailable) return null;

  const handleOpenSettings = async () => {
    if (isOpeningSettings) return;
    setIsOpeningSettings(true);
    const granted = await kimboMode.requestPermission();
    if (granted) {
      kimboMode.setEnabled(true);
      setIsVisible(false);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    setIsOpeningSettings(false);
  };

  const handleNeverAsk = async () => {
    kimboMode.setEnabled(false);
    await Storage.setItem(NEVER_ASK_KEY, "true");
    setIsVisible(false);
  };

  return (
    <Modal animationType="fade" onRequestClose={() => setIsVisible(false)} transparent visible={isVisible && !hasPermission}>
      <View style={[styles.backdrop, { padding: spacing.lg }]}>
        <Card style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.xl, gap: spacing.lg }]} variant="outlined">
          <View style={[styles.icon, { backgroundColor: colors.brandSoft, borderRadius: radius.pill }]}>
            <KimboCompanion framed={false} mood="happy" size={52} />
          </View>
          <View style={{ gap: spacing.sm }}>
            <Text variant="title">Keep Kimbo within reach</Text>
            <Text color="secondary">
              Kimbo Mode keeps one small interactive island above your apps for meal shortcuts, progress, and live walking updates.
            </Text>
          </View>
          <Button loading={isOpeningSettings} onPress={() => void handleOpenSettings()} size="lg">
            Open display settings
          </Button>
          <Button onPress={() => setIsVisible(false)} variant="ghost">Not now</Button>
          <Button onPress={() => void handleNeverAsk()} variant="ghost">Never ask again</Button>
        </Card>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: "rgba(0, 0, 0, 0.64)",
    flex: 1,
    justifyContent: "flex-end",
  },
  icon: {
    alignItems: "center",
    height: 52,
    justifyContent: "center",
    width: 52,
  },
  sheet: {
    borderWidth: StyleSheet.hairlineWidth,
    paddingBottom: 8,
  },
});
