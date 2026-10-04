import {
  HealthGoalInputSchema,
  type ActivityLevel,
  type GoalType,
  type HealthGoalInput,
} from "@kimbo/contracts";
import { calculateHealthTargets, type KimboMood } from "@kimbo/domain";
import { useRouter } from "expo-router";
import {
  Armchair,
  Bike,
  ChevronLeft,
  Drumstick,
  Equal,
  Flame,
  Footprints,
  TrendingDown,
  TrendingUp,
  type LucideIcon,
} from "lucide-react-native";
import { useEffect, useState } from "react";
import { BackHandler, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import Animated, { FadeIn, FadeInDown, ReduceMotion } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button, SurfaceGradient, Text, useKimboTheme } from "@/design-system";
import { KimboCompanion } from "@/features/kimbo/components/KimboCompanion";
import { mapAppErrorToMessage } from "@/shared/errors/AppError";

import { NumberField } from "../components/NumberField";
import { OptionCard } from "../components/OptionCard";
import { useCompleteOnboarding } from "../hooks/useCompleteOnboarding";

const steps = ["intro", "goal", "body", "activity", "plan"] as const;
type Step = (typeof steps)[number];

interface FormState {
  goalType: GoalType | null;
  currentWeightKg: string;
  targetWeightKg: string;
  heightCm: string;
  ageYears: string;
  activityLevel: ActivityLevel | null;
}

const initialForm: FormState = {
  goalType: null,
  currentWeightKg: "",
  targetWeightKg: "",
  heightCm: "",
  ageYears: "",
  activityLevel: null,
};

const goals: { value: GoalType; icon: LucideIcon; title: string; description: string }[] = [
  { value: "lose", icon: TrendingDown, title: "Lose weight", description: "A gentle daily calorie deficit" },
  { value: "maintain", icon: Equal, title: "Stay steady", description: "Keep today's weight, build better habits" },
  { value: "gain", icon: TrendingUp, title: "Build up", description: "A modest surplus with plenty of protein" },
];

const activityLevels: { value: ActivityLevel; icon: LucideIcon; title: string; description: string }[] = [
  { value: "sedentary", icon: Armchair, title: "Mostly seated", description: "Desk days, little planned exercise" },
  { value: "light", icon: Footprints, title: "Lightly active", description: "Walks and light movement most days" },
  { value: "moderate", icon: Bike, title: "Active", description: "Workouts or sport 3 to 5 days a week" },
  { value: "very_active", icon: Flame, title: "Very active", description: "Training hard almost every day" },
];

const parseNumber = (value: string) => Number(value.replace(",", "."));

/** What Kimbo says while you set up, step by step. */
const kimboLine: Record<Step, string> = {
  intro: "",
  goal: "First things first. What are we working toward?",
  body: "Just the basics. I keep these on your phone.",
  activity: "How much do you move on a normal day?",
  plan: "Here's our plan. I'll cheer, nag and celebrate as needed.",
};

export function OnboardingScreen() {
  const router = useRouter();
  const { colors, motion, radius, spacing } = useKimboTheme();
  const [step, setStep] = useState<Step>("intro");
  const [form, setForm] = useState<FormState>(initialForm);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const [pulse, setPulse] = useState(0);
  const completeOnboarding = useCompleteOnboarding();

  const index = steps.indexOf(step);
  const goTo = (next: Step) => {
    setValidationMessage(null);
    setStep(next);
  };

  // Android back walks back through the steps; only the first step lets the app close.
  useEffect(() => {
    if (index === 0) return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      setValidationMessage(null);
      setStep(steps[index - 1] ?? "intro");
      return true;
    });
    return () => subscription.remove();
  }, [index]);

  const buildInput = (activityLevel: ActivityLevel) =>
    HealthGoalInputSchema.safeParse({
      goalType: form.goalType,
      currentWeightKg: parseNumber(form.currentWeightKg),
      targetWeightKg: parseNumber(form.targetWeightKg),
      heightCm: parseNumber(form.heightCm),
      ageYears: parseNumber(form.ageYears),
      activityLevel,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    });

  const parsedInput = form.activityLevel ? buildInput(form.activityLevel) : null;
  const plan = parsedInput?.success ? calculateHealthTargets(parsedInput.data) : null;

  const selectGoal = (goalType: GoalType) => {
    setPulse((value) => value + 1);
    setForm((current) => ({
      ...current,
      goalType,
      targetWeightKg: goalType === "maintain" && current.currentWeightKg ? current.currentWeightKg : current.targetWeightKg,
    }));
  };

  const selectActivity = (activityLevel: ActivityLevel) => {
    setPulse((value) => value + 1);
    setForm((current) => ({ ...current, activityLevel }));
  };

  // Validate the body details as a whole before moving on, so errors appear next to the fields.
  const continueFromBody = () => {
    const parsed = buildInput(form.activityLevel ?? "light");
    if (!parsed.success) {
      setValidationMessage(parsed.error.issues[0]?.message ?? "Check the details and try again.");
      return;
    }
    goTo("activity");
  };

  const finish = async (input: HealthGoalInput) => {
    try {
      await completeOnboarding.mutateAsync(input);
      router.replace("/today");
    } catch {
      setValidationMessage(mapAppErrorToMessage({ type: "STORAGE_ERROR" }));
    }
  };

  const bodyComplete = Boolean(form.currentWeightKg && form.targetWeightKg && form.heightCm && form.ageYears);
  const mood: KimboMood = step === "activity" && form.activityLevel === "very_active" ? "playful" : "happy";

  const cta: { label: string; disabled: boolean; onPress: () => void } = (() => {
    switch (step) {
      case "intro":
        return { label: "Nice to meet you", disabled: false, onPress: () => goTo("goal") };
      case "goal":
        return { label: "Continue", disabled: !form.goalType, onPress: () => goTo("body") };
      case "body":
        return { label: "Continue", disabled: !bodyComplete, onPress: continueFromBody };
      case "activity":
        return { label: "See my plan", disabled: !form.activityLevel, onPress: () => goTo("plan") };
      case "plan":
        return {
          label: "Start with Kimbo",
          disabled: !parsedInput?.success,
          onPress: () => {
            if (parsedInput?.success) void finish(parsedInput.data);
          },
        };
    }
  })();

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={[styles.flex, { backgroundColor: colors.background }]}>
      <SafeAreaView edges={["top", "bottom"]} style={styles.flex}>
        {step !== "intro" ? (
          <View style={[styles.topBar, { gap: spacing.md, paddingHorizontal: spacing.lg }]}>
            <Pressable
              accessibilityLabel="Back"
              accessibilityRole="button"
              hitSlop={spacing.sm}
              onPress={() => goTo(steps[index - 1] ?? "intro")}
              style={[styles.back, { backgroundColor: colors.surfaceElevated, borderColor: colors.border, borderRadius: radius.pill }]}
            >
              <ChevronLeft color={colors.textPrimary} size={20} strokeWidth={2.2} />
            </Pressable>
            <View accessibilityLabel={`Step ${index} of ${steps.length - 1}`} style={[styles.segments, { gap: spacing.xs }]}>
              {steps.slice(1).map((name, segment) => (
                <View
                  key={name}
                  style={[styles.segment, { backgroundColor: segment < index ? colors.brand : colors.surfaceInteractive, borderRadius: radius.pill }]}
                />
              ))}
            </View>
          </View>
        ) : null}

        <ScrollView contentContainerStyle={[styles.content, { gap: spacing.xl, padding: spacing.lg }]} keyboardShouldPersistTaps="handled">
          {step === "intro" ? (
            <Animated.View entering={FadeIn.duration(motion.duration.slow).reduceMotion(ReduceMotion.System)} style={[styles.intro, { gap: spacing.lg }]}>
              <View style={styles.introGlow}>
                <SurfaceGradient center={{ x: 0.5, y: 0.5 }} from={colors.heroGlow} to={colors.heroGlowFade} variant="radial" />
                <KimboCompanion framed={false} mood="happy" pulse={pulse} size={190} />
              </View>
              <View style={[styles.center, { gap: spacing.sm }]}>
                <Text color="brand" style={styles.eyebrow} variant="caption">MEET KIMBO</Text>
                <Text align="center" variant="display">Hi, I&apos;m Kimbo.</Text>
                <Text align="center" color="secondary" style={styles.lead}>
                  Your cute fitness companion. I watch your meals, protein and steps, and I have feelings about all three.
                </Text>
              </View>
            </Animated.View>
          ) : (
            <Animated.View entering={FadeInDown.duration(motion.duration.normal).reduceMotion(ReduceMotion.System)} key={step} style={{ gap: spacing.xl }}>
              <View style={[styles.speech, { gap: spacing.md }]}>
                <KimboCompanion mood={mood} onPress={() => setPulse((value) => value + 1)} pulse={pulse} size={64} />
                <View style={[styles.bubble, { backgroundColor: colors.surfaceElevated, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md }]}>
                  <Text style={styles.bubbleText} variant="bodySmall">{kimboLine[step]}</Text>
                </View>
              </View>

              {step === "goal" ? (
                <View accessibilityRole="radiogroup" style={{ gap: spacing.md }}>
                  <Text variant="title">Your goal</Text>
                  {goals.map((goal) => (
                    <OptionCard {...goal} key={goal.value} onSelect={() => selectGoal(goal.value)} selected={form.goalType === goal.value} />
                  ))}
                </View>
              ) : null}

              {step === "body" ? (
                <View style={{ gap: spacing.lg }}>
                  <Text variant="title">About you</Text>
                  <View style={[styles.grid, { gap: spacing.md }]}>
                    <View style={styles.cell}>
                      <NumberField
                        label="Current weight"
                        onChangeText={(currentWeightKg) =>
                          setForm((current) => ({
                            ...current,
                            currentWeightKg,
                            targetWeightKg: current.goalType === "maintain" ? currentWeightKg : current.targetWeightKg,
                          }))
                        }
                        unit="kg"
                        value={form.currentWeightKg}
                      />
                    </View>
                    <View style={styles.cell}>
                      <NumberField label="Target weight" onChangeText={(targetWeightKg) => setForm((current) => ({ ...current, targetWeightKg }))} unit="kg" value={form.targetWeightKg} />
                    </View>
                    <View style={styles.cell}>
                      <NumberField label="Height" onChangeText={(heightCm) => setForm((current) => ({ ...current, heightCm }))} unit="cm" value={form.heightCm} />
                    </View>
                    <View style={styles.cell}>
                      <NumberField label="Age" onChangeText={(ageYears) => setForm((current) => ({ ...current, ageYears }))} unit="yrs" value={form.ageYears} />
                    </View>
                  </View>
                  <Text color="muted" variant="caption">Estimates only, not medical advice. You can change these later.</Text>
                </View>
              ) : null}

              {step === "activity" ? (
                <View accessibilityRole="radiogroup" style={{ gap: spacing.md }}>
                  <Text variant="title">Your rhythm</Text>
                  {activityLevels.map((level) => (
                    <OptionCard {...level} key={level.value} onSelect={() => selectActivity(level.value)} selected={form.activityLevel === level.value} />
                  ))}
                </View>
              ) : null}

              {step === "plan" && plan ? (
                <View style={{ gap: spacing.md }}>
                  <Text variant="title">Your daily plan</Text>
                  <PlanTile gradient={colors.gradientCalories} icon={Flame} label="Calories" unit="kcal a day" value={plan.dailyCalorieTarget.toLocaleString()} />
                  <PlanTile gradient={colors.gradientProtein} icon={Drumstick} label="Protein" unit="grams a day" value={String(plan.dailyProteinTargetGrams)} />
                  <PlanTile gradient={colors.gradientSteps} icon={Footprints} label="Movement" unit="steps a day" value={plan.dailyStepTarget.toLocaleString()} />
                </View>
              ) : null}
            </Animated.View>
          )}

          {validationMessage ? (
            <Text accessibilityRole="alert" color="danger" variant="bodySmall">{validationMessage}</Text>
          ) : null}
        </ScrollView>

        <View style={[styles.footer, { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg }]}>
          <Button disabled={cta.disabled} loading={step === "plan" && completeOnboarding.isPending} onPress={cta.onPress} size="lg">
            {cta.label}
          </Button>
        </View>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

function PlanTile({ gradient, icon: Icon, label, unit, value }: { gradient: readonly [string, string]; icon: LucideIcon; label: string; unit: string; value: string }) {
  const { colors, radius, spacing } = useKimboTheme();
  return (
    <View style={[styles.tile, { borderColor: colors.border, borderRadius: radius.lg, gap: spacing.md, padding: spacing.lg }]}>
      <SurfaceGradient borderRadius={radius.lg} from={colors.surfaceElevated} to={colors.surface} />
      <View style={[styles.tileIcon, { borderRadius: radius.md }]}>
        <SurfaceGradient borderRadius={radius.md} from={gradient[0]} to={gradient[1]} />
        <Icon color={colors.textInverse} size={22} strokeWidth={2.2} />
      </View>
      <View style={styles.flex}>
        <Text color="secondary" variant="caption">{label.toUpperCase()}</Text>
        <Text variant="numericMedium">{value}</Text>
      </View>
      <Text color="muted" variant="bodySmall">{unit}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { alignItems: "center" },
  topBar: { alignItems: "center", flexDirection: "row", paddingTop: 8 },
  back: { alignItems: "center", borderWidth: StyleSheet.hairlineWidth, height: 40, justifyContent: "center", width: 40 },
  segments: { flex: 1, flexDirection: "row" },
  segment: { flex: 1, height: 4 },
  content: { flexGrow: 1 },
  intro: { alignItems: "center", flex: 1, justifyContent: "center", paddingTop: 24 },
  introGlow: { alignItems: "center", height: 260, justifyContent: "center", width: 260 },
  eyebrow: { letterSpacing: 1.6 },
  lead: { maxWidth: 320 },
  speech: { alignItems: "center", flexDirection: "row" },
  bubble: { borderWidth: StyleSheet.hairlineWidth, flex: 1 },
  bubbleText: { fontFamily: "Manrope_600SemiBold", fontSize: 15, lineHeight: 21 },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  cell: { flexBasis: "47%", flexGrow: 1 },
  tile: { alignItems: "center", borderWidth: StyleSheet.hairlineWidth, flexDirection: "row", overflow: "hidden" },
  tileIcon: { alignItems: "center", height: 44, justifyContent: "center", overflow: "hidden", width: 44 },
  footer: { paddingTop: 8 },
});
