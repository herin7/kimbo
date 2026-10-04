import { CameraView, useCameraPermissions } from "expo-camera";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { ImageIcon, Sparkles, X } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Image, Linking, Pressable, StyleSheet, View } from "react-native";
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
  const [state, setState] = useState<CaptureState>("permission");
  const [previewUri, setPreviewUri] = useState<string>();
  const [errorMessage, setErrorMessage] = useState("");
  const [isCapturing, setIsCapturing] = useState(false);
  const saveDraft = useSaveMealDraft();

  useEffect(() => {
    if (permission?.granted && state === "permission") setState("camera");
  }, [permission?.granted, state]);

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
        : "Kimbo couldn't analyse that photo. Try another or describe the meal instead.");
      setState("error");
    }
  };

  const handlePermission = async () => {
    const result = await requestPermission();
    setState(result.granted ? "camera" : "denied");
  };

  const handleCapture = async () => {
    if (isCapturing) return;
    setIsCapturing(true);
    try {
      const photo = await camera.current?.takePictureAsync({ quality: 0.72, skipProcessing: false });
      if (!photo) return;
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await analyse(photo.uri, photo.format === "png" ? "image/png" : "image/jpeg");
    } catch {
      setErrorMessage("The camera couldn't capture that photo. Try again or choose one from your gallery.");
      setState("error");
    } finally {
      setIsCapturing(false);
    }
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
          <Text color="secondary">Kimbo uses the camera only for the meal you choose. You'll review every detected food before it is saved.</Text>
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
        {previewUri ? <Image accessibilityLabel="Captured meal" blurRadius={1} source={{ uri: previewUri }} style={StyleSheet.absoluteFill} /> : null}
        <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.scrim }]} />
        <SafeAreaView style={[styles.analysisContent, { gap: spacing.xl, padding: spacing.xl }]}>
          <View style={[styles.analysisFrame, { borderColor: colors.textInverse, borderRadius: radius.xl }]}>
            <ScanLine />
            <ScannerCorners color={colors.textInverse} />
          </View>
          <View style={[styles.analysisStatus, { backgroundColor: colors.activityIslandBackground, borderColor: colors.activityIslandBorder, borderRadius: radius.xl, gap: spacing.md, padding: spacing.lg }]}>
            <ActivityIndicator color={colors.activityIslandAccent} />
            <View style={styles.analysisCopy}>
              <Text color="inverse" variant="heading">Reading your plate</Text>
              <Text color="inverse" style={styles.analysisDetail} variant="bodySmall">Finding foods and estimating portions…</Text>
            </View>
            <Sparkles color={colors.activityIslandAccent} size={21} strokeWidth={2} />
          </View>
        </SafeAreaView>
      </View>
    );
  }

  if (state === "error") {
    return (
      <Screen>
        <Text variant="title">We couldn't identify that meal</Text>
        <Text accessibilityRole="alert" color="secondary">{errorMessage}</Text>
        <Button onPress={() => { setPreviewUri(undefined); setState(permission?.granted ? "camera" : "permission"); }}>Try another photo</Button>
        <Button onPress={() => router.replace("/meal/manual")} variant="ghost">Enter manually</Button>
      </Screen>
    );
  }

  return (
    <View style={[styles.full, { backgroundColor: colors.activityIslandBackground }]}>
      <CameraView facing="back" ref={camera} style={StyleSheet.absoluteFill} />
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.cameraShade]} />
      <SafeAreaView edges={["top", "bottom"]} style={styles.cameraControls}>
        <View style={[styles.cameraHeader, { paddingHorizontal: spacing.lg, paddingTop: spacing.sm }]}>
          <Pressable
            accessibilityLabel="Close camera"
            accessibilityRole="button"
            hitSlop={spacing.sm}
            onPress={() => router.back()}
            style={({ pressed }) => [styles.circleAction, { backgroundColor: colors.activityIslandBackground, borderColor: colors.activityIslandBorder, borderRadius: radius.pill, opacity: pressed ? 0.72 : 1 }]}
          >
            <X color={colors.activityIslandPrimary} size={21} strokeWidth={2.2} />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text color="inverse" align="center" variant="heading">Scan your meal</Text>
            <Text color="inverse" align="center" style={styles.headerHint} variant="caption">Keep the whole plate inside the frame</Text>
          </View>
          <View style={styles.headerBalance} />
        </View>

        <View style={styles.scannerStage}>
          <View style={[styles.frame, { borderRadius: radius.xl }]}>
            <ScanLine />
            <ScannerCorners color={colors.textInverse} />
          </View>
          <View style={[styles.holdStillPill, { backgroundColor: colors.activityIslandBackground, borderColor: colors.activityIslandBorder, borderRadius: radius.pill, marginTop: spacing.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.sm }]}>
            <Sparkles color={colors.activityIslandAccent} size={14} strokeWidth={2.2} />
            <Text color="inverse" variant="caption">Kimbo will identify each item</Text>
          </View>
        </View>

        <View style={[styles.capturePanel, { backgroundColor: colors.activityIslandBackground, borderColor: colors.activityIslandBorder, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, paddingHorizontal: spacing.xl, paddingVertical: spacing.lg }]}>
          <Pressable
            accessibilityLabel="Choose meal from gallery"
            accessibilityRole="button"
            onPress={handleGallery}
            style={({ pressed }) => [styles.galleryAction, { backgroundColor: colors.surfaceInteractive, borderRadius: radius.lg, opacity: pressed ? 0.72 : 1 }]}
          >
            <ImageIcon color={colors.activityIslandPrimary} size={22} strokeWidth={2} />
            <Text color="inverse" variant="caption">Gallery</Text>
          </Pressable>
          <Pressable
            accessibilityLabel="Capture meal photo"
            accessibilityRole="button"
            accessibilityState={{ busy: isCapturing, disabled: isCapturing }}
            disabled={isCapturing}
            onPress={handleCapture}
            style={({ pressed }) => [styles.capture, { borderColor: colors.activityIslandPrimary, opacity: pressed || isCapturing ? 0.66 : 1 }]}
          >
            <View style={[styles.captureInner, { backgroundColor: colors.activityIslandAccent }]} />
          </Pressable>
          <View style={styles.captureBalance} />
        </View>
      </SafeAreaView>
    </View>
  );
}

function ScannerCorners({ color }: { color: string }) {
  return (
    <>
      <View style={[styles.corner, styles.topLeft, { borderColor: color }]} />
      <View style={[styles.corner, styles.topRight, { borderColor: color }]} />
      <View style={[styles.corner, styles.bottomLeft, { borderColor: color }]} />
      <View style={[styles.corner, styles.bottomRight, { borderColor: color }]} />
    </>
  );
}

const styles = StyleSheet.create({
  full: { flex: 1 },
  cameraShade: { backgroundColor: "rgba(0, 0, 0, 0.14)" },
  cameraControls: { flex: 1, justifyContent: "space-between" },
  cameraHeader: { alignItems: "center", flexDirection: "row" },
  circleAction: { alignItems: "center", borderWidth: StyleSheet.hairlineWidth, height: 48, justifyContent: "center", width: 48 },
  headerCopy: { flex: 1 },
  headerHint: { opacity: 0.78 },
  headerBalance: { width: 48 },
  scannerStage: { alignItems: "center", flex: 1, justifyContent: "center" },
  frame: { aspectRatio: 1.08, maxWidth: 420, overflow: "hidden", position: "relative", width: "84%" },
  corner: { height: 34, position: "absolute", width: 34 },
  topLeft: { borderLeftWidth: 3, borderTopWidth: 3, left: 0, top: 0 },
  topRight: { borderRightWidth: 3, borderTopWidth: 3, right: 0, top: 0 },
  bottomLeft: { borderBottomWidth: 3, borderLeftWidth: 3, bottom: 0, left: 0 },
  bottomRight: { borderBottomWidth: 3, borderRightWidth: 3, bottom: 0, right: 0 },
  holdStillPill: { alignItems: "center", borderWidth: StyleSheet.hairlineWidth, flexDirection: "row", gap: 8 },
  capturePanel: { alignItems: "center", borderTopWidth: StyleSheet.hairlineWidth, flexDirection: "row", justifyContent: "space-between" },
  galleryAction: { alignItems: "center", height: 58, justifyContent: "center", width: 76 },
  capture: { alignItems: "center", borderRadius: 44, borderWidth: 3, height: 80, justifyContent: "center", width: 80 },
  captureInner: { borderRadius: 34, height: 64, width: 64 },
  captureBalance: { width: 76 },
  analysisContent: { alignItems: "center", flex: 1, justifyContent: "center" },
  analysisFrame: { aspectRatio: 1.08, borderWidth: StyleSheet.hairlineWidth, maxWidth: 420, overflow: "hidden", position: "relative", width: "88%" },
  analysisStatus: { alignItems: "center", borderWidth: StyleSheet.hairlineWidth, flexDirection: "row", maxWidth: 420, width: "100%" },
  analysisCopy: { flex: 1 },
  analysisDetail: { opacity: 0.72 },
});
