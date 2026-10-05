import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder } from "expo-audio";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Linking, StyleSheet, View } from "react-native";

import { Button, Card, PermissionFallback, Screen, Text, useKimboTheme } from "@/design-system";
import { KimboApiError } from "@/shared/api/api-client";
import { mapAppErrorToMessage } from "@/shared/errors/AppError";
import KimboActivityModule from "../../../../modules/live-update";

import { analyseTextMeal, transcribeMeal } from "../api/meal.api";
import { ListeningPulse } from "../components/ListeningPulse";
import { getDefaultMealType } from "../domain/meal.defaults";
import { createDraftFromAnalysis } from "../domain/meal-draft";
import { useSaveMealDraft } from "../hooks/meal.queries";

type VoiceState = "explanation" | "recording" | "transcribing" | "analysing" | "denied" | "error";

const formatDuration = (milliseconds: number) => {
  const totalSeconds = Math.floor(milliseconds / 1_000);
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, "0")}`;
};

export function VoiceMealScreen() {
  const router = useRouter();
  const { spacing } = useKimboTheme();
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const saveDraft = useSaveMealDraft();
  const [state, setState] = useState<VoiceState>("explanation");
  const [durationMillis, setDurationMillis] = useState(0);
  const [transcript, setTranscript] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const recordingStartedAt = useRef(0);

  useEffect(() => () => {
    // useAudioRecorder owns and releases the native recorder before screen-level
    // cleanup. Touching it here can access an already-released SharedObject.
    void setAudioModeAsync({ allowsRecording: false });
  }, []);

  useEffect(() => {
    if (state !== "recording") return;
    const updateDuration = () => setDurationMillis(Date.now() - recordingStartedAt.current);
    updateDuration();
    const interval = setInterval(updateDuration, 250);
    return () => clearInterval(interval);
  }, [state]);

  const startRecording = async () => {
    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        setState("denied");
        return;
      }
      // Upgrade the active island service while the app is visible. Android won't allow a
      // background-started service to acquire microphone access later on its own.
      KimboActivityModule?.enableIslandMicrophone();
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record({ forDuration: 60 });
      recordingStartedAt.current = Date.now();
      setDurationMillis(0);
      setState("recording");
    } catch {
      setErrorMessage("The microphone couldn’t start. You can still type your meal.");
      setState("error");
    }
  };

  const stopAndAnalyse = async () => {
    if (state !== "recording") return;
    setState("transcribing");
    try {
      await recorder.stop();
      await setAudioModeAsync({ allowsRecording: false });
      if (!recorder.uri) throw new Error("Recording file unavailable");
      const transcription = await transcribeMeal(recorder.uri);
      setTranscript(transcription.transcript);
      setState("analysing");
      const analysis = await analyseTextMeal(transcription.transcript);
      await saveDraft.mutateAsync(createDraftFromAnalysis(analysis, "voice", getDefaultMealType()));
      router.replace("/meal/confirm");
    } catch (error) {
      setErrorMessage(error instanceof KimboApiError
        ? mapAppErrorToMessage(error.appError)
        : "Kimbo couldn’t process that recording. Try again or type the meal instead.");
      setState("error");
    }
  };

  const cancelRecording = async () => {
    try {
      await recorder.stop();
    } catch {
      // The recorder hook releases native resources during navigation cleanup.
    } finally {
      await setAudioModeAsync({ allowsRecording: false });
      router.back();
    }
  };

  if (state === "denied") {
    return <Screen><PermissionFallback description="You can still type your meal manually. Kimbo won’t ask for microphone access until you choose voice again." onPrimaryPress={() => void Linking.openSettings()} onSecondaryPress={() => router.replace("/meal/manual")} primaryLabel="Open settings" secondaryLabel="Type instead" title="Microphone access is off" /></Screen>;
  }

  if (state === "explanation") {
    return (
      <Screen>
        <View style={{ gap: spacing.sm }}>
          <Text variant="title">Tell Kimbo what you ate</Text>
          <Text color="secondary">Microphone access is used only while you record this meal. You’ll review every estimate before saving.</Text>
        </View>
        <Card variant="outlined"><Text color="secondary">Try: “I had two rotis, paneer sabzi and a glass of buttermilk.”</Text></Card>
        <Button onPress={startRecording}>Allow microphone and start</Button>
        <Button onPress={() => router.replace("/meal/manual")} variant="ghost">Type instead</Button>
      </Screen>
    );
  }

  if (state === "recording") {
    return (
      <Screen scroll={false} contentContainerStyle={styles.centered}>
        <ListeningPulse />
        <View style={{ gap: spacing.sm }}>
          <Text style={styles.centerText} variant="title">Listening…</Text>
          <Text color="secondary" style={styles.centerText}>Speak naturally and include portions when you know them.</Text>
        </View>
        <Text accessibilityLabel={`${formatDuration(durationMillis)} elapsed`} variant="numericLarge">{formatDuration(durationMillis)}</Text>
        <Button onPress={stopAndAnalyse}>Finish recording</Button>
        <Button onPress={cancelRecording} variant="ghost">Cancel</Button>
      </Screen>
    );
  }

  if (state === "error") {
    return (
      <Screen>
        <Text variant="title">We couldn’t analyse that meal</Text>
        <Text accessibilityRole="alert" color="secondary">{errorMessage}</Text>
        <Button onPress={() => setState("explanation")}>Try again</Button>
        <Button onPress={() => router.replace("/meal/manual")} variant="ghost">Enter manually</Button>
      </Screen>
    );
  }

  return (
    <Screen scroll={false} contentContainerStyle={styles.centered}>
      <ListeningPulse />
      <Text variant="title">{state === "transcribing" ? "Turning speech into text…" : "Understanding your meal…"}</Text>
      {transcript ? <Text color="secondary" style={styles.centerText}>“{transcript}”</Text> : null}
      <Text color="muted" variant="caption">Keep Kimbo open for a moment.</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({ centered: { alignItems: "center", justifyContent: "center" }, centerText: { textAlign: "center" } });
