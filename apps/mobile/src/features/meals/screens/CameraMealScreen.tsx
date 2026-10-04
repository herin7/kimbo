import { CameraView, useCameraPermissions } from "expo-camera";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import { Image, Linking, Pressable, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button, PermissionFallback, Screen, Text, useKimboTheme } from "@/design-system";
import { KimboApiError } from "@/shared/api/api-client";
import { mapAppErrorToMessage } from "@/shared/errors/AppError";

import { analyseImageMeal } from "../api/meal.api";
import { ScanLine } from "../components/ScanLine";
import { getDefaultMealType } from "../domain/meal.defaults";
import { createDraftFromAnalysis } from "../domain/meal-draft";
import { useSaveMealDraft } from "../hooks/meal.queries";

type CaptureState = "permission" | "camera" | "analysing" | "denied" | "error";

export function CameraMealScreen() {
  const router = useRouter();
  const { colors, radius, spacing } = useKimboTheme();
  const camera = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [state, setState] = useState<CaptureState>(permission?.granted ? "camera" : "permission");
  const [previewUri, setPreviewUri] = useState<string>();
  const [errorMessage, setErrorMessage] = useState("");
  const saveDraft = useSaveMealDraft();

  const analyse = async (uri: string, mimeType: string) => {
    setPreviewUri(uri);
    setState("analysing");
    try {
      const analysis = await analyseImageMeal(uri, mimeType);
      await saveDraft.mutateAsync(createDraftFromAnalysis(analysis, "image", getDefaultMealType()));
      router.replace("/meal/confirm");
    } catch (error) {
      setErrorMessage(error instanceof KimboApiError
        ? mapAppErrorToMessage(error.appError)
        : "Kimbo couldn’t analyse that photo. Try another or describe the meal instead.");
      setState("error");
    }
  };

  const handlePermission = async () => {
    const result = await requestPermission();
    setState(result.granted ? "camera" : "denied");
  };

  const handleCapture = async () => {
    const photo = await camera.current?.takePictureAsync({ quality: 0.72, skipProcessing: false });
    if (!photo) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await analyse(photo.uri, photo.format === "png" ? "image/png" : "image/jpeg");
  };

  const handleGallery = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.72 });
    if (result.canceled) return;
    const asset = result.assets[0];
    if (!asset) return;
    await analyse(asset.uri, asset.mimeType ?? "image/jpeg");
  };

  if (state === "permission") {
    return (
      <Screen>
        <View style={{ gap: spacing.sm }}>
          <Text variant="title">Scan your meal</Text>
          <Text color="secondary">Kimbo uses the camera only to capture the meal you choose. You’ll review all detected foods before saving.</Text>
        </View>
        <Button onPress={handlePermission}>Allow camera</Button>
        <Button onPress={handleGallery} variant="secondary">Choose from gallery</Button>
        <Button onPress={() => router.replace("/meal/manual")} variant="ghost">Describe meal instead</Button>
      </Screen>
    );
  }

  if (state === "denied") {
    return (
      <Screen>
        <PermissionFallback description="Choose an existing photo or describe the meal. Meal logging still works without camera access." onPrimaryPress={() => void Linking.openSettings()} onSecondaryPress={handleGallery} primaryLabel="Open settings" secondaryLabel="Choose from gallery" title="Camera access is off" />
        <Button onPress={() => router.replace("/meal/manual")} variant="ghost">Describe meal instead</Button>
      </Screen>
    );
  }

  if (state === "analysing") {
    return (
      <View style={[styles.full, { backgroundColor: colors.background }]}>
        {previewUri ? <Image accessibilityLabel="Captured meal" blurRadius={2} source={{ uri: previewUri }} style={StyleSheet.absoluteFill} /> : null}
        <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.scrim }]} />
        <SafeAreaView style={styles.analysisContent}>
          <View style={styles.analysisFrame}><ScanLine /></View>
          <Text color="inverse" variant="title">Scanning meal…</Text>
          <Text color="inverse" style={styles.centerText}>Looking for foods and estimating portions.</Text>
        </SafeAreaView>
      </View>
    );
  }

  if (state === "error") {
    return (
      <Screen>
        <Text variant="title">We couldn’t identify that meal</Text>
        <Text accessibilityRole="alert" color="secondary">{errorMessage}</Text>
        <Button onPress={() => { setPreviewUri(undefined); setState(permission?.granted ? "camera" : "permission"); }}>Try another photo</Button>
        <Button onPress={() => router.replace("/meal/manual")} variant="ghost">Enter manually</Button>
      </Screen>
    );
  }

  return (
    <View style={styles.full}>
      <CameraView facing="back" ref={camera} style={StyleSheet.absoluteFill} />
      <SafeAreaView edges={["top", "bottom"]} style={styles.cameraControls}>
        <View style={[styles.cameraHeader, { padding: spacing.lg }]}>
          <Button onPress={() => router.back()} size="sm" variant="secondary">Close</Button>
          <Text color="inverse" variant="heading">Frame the whole meal</Text>
        </View>
        <View style={[styles.frame, { borderColor: colors.textInverse, borderRadius: radius.xl }]}><ScanLine /></View>
        <View style={[styles.captureRow, { padding: spacing.xl }]}>
          <Button onPress={handleGallery} size="sm" variant="secondary">Gallery</Button>
          <Pressable accessibilityLabel="Capture meal photo" accessibilityRole="button" onPress={handleCapture} style={({ pressed }) => [styles.capture, { borderColor: colors.textInverse, opacity: pressed ? 0.7 : 1 }]}>
            <View style={[styles.captureInner, { backgroundColor: colors.textInverse }]} />
          </Pressable>
          <View style={styles.balance} />
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  full: { flex: 1 },
  cameraControls: { flex: 1, justifyContent: "space-between" },
  cameraHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  frame: { alignSelf: "center", borderWidth: 2, height: 240, overflow: "hidden", width: "82%" },
  captureRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  capture: { alignItems: "center", borderRadius: 40, borderWidth: 4, height: 76, justifyContent: "center", width: 76 },
  captureInner: { borderRadius: 32, height: 60, width: 60 },
  balance: { width: 78 },
  analysisContent: { alignItems: "center", flex: 1, justifyContent: "center", overflow: "hidden" },
  analysisFrame: { height: 240, position: "absolute", width: "100%" },
  centerText: { textAlign: "center" },
});
