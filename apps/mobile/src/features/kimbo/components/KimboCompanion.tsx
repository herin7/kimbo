import type { KimboMood } from "@kimbo/domain";
import { Fit, RiveView, useRive, useRiveFile } from "@rive-app/react-native";
import * as Haptics from "expo-haptics";

import { useEffect, useRef, useState } from "react";
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
  const [hasRuntimeError, setHasRuntimeError] = useState(false);
  const moodTransition = useRef(0);

  // Replays whenever the mood changes or a parent bumps `pulse`. A trigger that fails is not
  // fatal (the idle blink keeps running); file/render failures arrive through RiveView.onError.
  useEffect(() => {
    if (!riveViewRef) return;
    const transition = ++moodTransition.current;
    void riveViewRef.reset().then(() => {
      if (transition !== moodTransition.current) return;
      if (mood !== "neutral") riveViewRef.triggerInput(moodTrigger[mood]);
      riveViewRef.playIfNeeded();
    }).catch(() => setHasRuntimeError(true));
  }, [mood, pulse, riveViewRef]);

  const handlePress = () => {
    void Haptics.selectionAsync();
    if (onPress) return onPress();
    if (!riveViewRef) return;
    const transition = ++moodTransition.current;
    void riveViewRef.reset().then(() => {
      if (transition !== moodTransition.current) return;
      if (mood !== "neutral") riveViewRef.triggerInput(moodTrigger[mood]);
      riveViewRef.playIfNeeded();
    }).catch(() => setHasRuntimeError(true));
  };

  const showFallback = Boolean(error) || hasRuntimeError || (framed && !riveFile);

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
          onError={() => setHasRuntimeError(true)}
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
