import type { KimboMood } from "@kimbo/domain";
import { Fit, RiveView, useRive, useRiveFile } from "@rive-app/react-native";
import * as Haptics from "expo-haptics";

import { useEffect } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";

import moodAsset from "../../../../assets/rive/kimbo-mood.riv";
import { useKimboTheme } from "@/design-system";

// Release builds pack a required .riv as a resource name Rive cannot open, so Android loads the copy
// the native module ships in res/raw (kimbo_mood.riv, kept identical to assets/rive). Dev, release and OTA all work.
const riveSource = Platform.OS === "android" ? "kimbo_mood" : moodAsset;

/** State machine triggers in kimbo-mood.riv. Neutral plays the idle blink/look layers only. */
const moodTrigger: Record<Exclude<KimboMood, "neutral">, "Happy" | "Sad" | "Angry" | "Crazy"> = {
  happy: "Happy",
  playful: "Crazy",
  sad: "Sad",
  angry: "Angry",
};

export interface KimboCompanionProps {
  mood: KimboMood;
  size?: number;
  /** Shows a soft circular frame; off for hero placements like the launch intro. */
  framed?: boolean;
  /** Bump to replay the current mood (e.g. after the user taps something nearby). */
  pulse?: number;
  onPress?: () => void;
  accessibilityLabel?: string;
}

export function KimboCompanion({
  accessibilityLabel,
  framed = true,
  mood,
  onPress,
  pulse = 0,
  size = 84,
}: KimboCompanionProps) {
  const { colors } = useKimboTheme();
  const { riveFile, error } = useRiveFile(riveSource);
  const { riveViewRef, setHybridRef } = useRive();

  // Rive's reset() always rejects on this (experimental) Android backend, so it must not gate the
  // trigger or flip Kimbo to the fallback; a failed trigger just leaves the idle blink running.
  const play = () => {
    if (!riveViewRef) return;
    try {
      if (mood !== "neutral") riveViewRef.triggerInput(moodTrigger[mood]);
      riveViewRef.playIfNeeded();
    } catch {
      // Non-fatal; see above.
    }
  };

  useEffect(() => {
    play();
    // play reads the latest ref; re-run only when the mood, an explicit pulse or the view changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mood, pulse, riveViewRef]);

  const handlePress = () => {
    void Haptics.selectionAsync();
    if (onPress) return onPress();
    play();
  };

  const showFallback = Boolean(error) || (framed && !riveFile);

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel ?? `Kimbo looks ${mood}. Tap for a reaction.`}
      accessibilityRole="button"
      hitSlop={8}
      onPress={handlePress}
      style={({ pressed }) => [
        styles.container,
        {
          backgroundColor: framed ? colors.surfaceElevated : "transparent",
          borderColor: framed ? colors.brandGlow : "transparent",
          borderRadius: size / 2,
          height: size,
          opacity: pressed ? 0.82 : 1,
          transform: [{ scale: pressed ? 0.94 : 1 }],
          width: size,
        },
      ]}
    >
      {showFallback ? (
        <View style={styles.fallback}>
          <View style={{ backgroundColor: colors.brand, borderRadius: size, height: size * 0.62, width: size * 0.62 }} />
        </View>
      ) : !riveFile ? null : (
        <RiveView
          artboardName="Artboard"
          autoPlay
          file={riveFile}
          fit={Fit.Contain}
          hybridRef={setHybridRef}
          // Rive reports non-fatal warnings here too (e.g. "reset() is not supported on the experimental
          // backend") while still rendering; only a missing file (useRiveFile error) shows the fallback.
          onError={() => undefined}
          stateMachineName="State Machine 1"
          style={styles.rive}
        />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { borderWidth: StyleSheet.hairlineWidth, overflow: "hidden" },
  fallback: { alignItems: "center", flex: 1, justifyContent: "center" },
  rive: { height: "100%", width: "100%" },
});
