import * as Haptics from "expo-haptics";
import { usePathname, useRouter, type Href } from "expo-router";
import { CalendarDays, Footprints, SunMedium, UserRound } from "lucide-react-native";
import { useEffect, useState } from "react";
import { BackHandler, Platform, Pressable, StyleSheet, View, type LayoutChangeEvent } from "react-native";
import Animated, { ReduceMotion, useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SurfaceGradient, Text, useKimboTheme } from "@/design-system";

const destinations = [
  { label: "Today", route: "/today" as const, Icon: SunMedium },
  { label: "Activity", route: "/activity" as const, Icon: Footprints },
  { label: "Progress", route: "/progress" as const, Icon: CalendarDays },
  { label: "Profile", route: "/profile" as const, Icon: UserRound },
];

type Route = Parameters<ReturnType<typeof useRouter>["push"]>[0];
const BAR_PADDING = 5;
const indicatorSpring = { dampingRatio: 0.82, duration: 340, reduceMotion: ReduceMotion.System } as const;

/**
 * Stack tree: Today is the root; Activity/Progress sit one level above it; meal flows push on top.
 * Back from any tab returns to Today, back from Today exits.
 */
export function useGoTo() {
  const pathname = usePathname();
  const router = useRouter();
  return (route: Route) => {
    if (route === pathname) return;
    if (route === "/today") return router.dismissTo("/today");
    const onSiblingTab = pathname !== "/today" && destinations.some((d) => d.route === pathname);
    if (onSiblingTab && destinations.some((d) => d.route === route)) return router.replace(route);
    router.push(route);
  };
}

/**
 * Android back never exits from a screen that has nothing beneath it (e.g. one opened from the
 * island via a deep link): it lands on Today instead. Back on Today still leaves the app.
 */
export function useBackFallsBackToToday(isEnabled: boolean) {
  const pathname = usePathname();
  const router = useRouter();
  useEffect(() => {
    if (!isEnabled || Platform.OS !== "android") return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (pathname === "/today") return false;
      if (destinations.some(({ route }) => route === pathname)) {
        router.replace("/today");
        return true;
      }
      if (router.canGoBack()) router.back();
      else router.replace("/today");
      return true;
    });
    return () => subscription.remove();
  }, [isEnabled, pathname, router]);
}

export function MainNavigation() {
  const pathname = usePathname();
  const goTo = useGoTo();
  const insets = useSafeAreaInsets();
  const { colors, radius, spacing } = useKimboTheme();
  const routeIndex = destinations.findIndex(({ route }) => route === pathname);
  // Selection moves the moment a tab is pressed; the route catches up underneath.
  const [pendingIndex, setPendingIndex] = useState<number | null>(null);
  const [lastRouteIndex, setLastRouteIndex] = useState(routeIndex);
  if (routeIndex !== lastRouteIndex) {
    setLastRouteIndex(routeIndex);
    setPendingIndex(null);
  }
  const selectedIndex = pendingIndex ?? Math.max(0, routeIndex);
  const slotWidth = useSharedValue(0);
  const indicatorX = useSharedValue(0);

  useEffect(() => {
    indicatorX.set(withSpring(selectedIndex * slotWidth.get(), indicatorSpring));
  }, [indicatorX, selectedIndex, slotWidth]);

  const indicatorStyle = useAnimatedStyle(() => ({
    opacity: slotWidth.get() > 0 ? 1 : 0,
    transform: [{ translateX: indicatorX.get() }],
    width: slotWidth.get(),
  }));

  if (routeIndex < 0) return null;

  const handleLayout = (event: LayoutChangeEvent) => {
    const width = (event.nativeEvent.layout.width - BAR_PADDING * 2) / destinations.length;
    slotWidth.set(width);
    indicatorX.set(selectedIndex * width);
  };

  return (
    <View pointerEvents="box-none" style={[styles.host, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
      <View onLayout={handleLayout} style={[styles.bar, { borderColor: colors.border, borderRadius: radius.pill, padding: BAR_PADDING }]}>
        <SurfaceGradient from={colors.surfaceElevated} to={colors.surfaceSunken} variant="vertical" />
        <Animated.View pointerEvents="none" style={[styles.indicator, { borderColor: colors.brandGlow, borderRadius: radius.pill, top: BAR_PADDING, left: BAR_PADDING }, indicatorStyle]}>
          <SurfaceGradient from={colors.brandSoft} to={colors.surfaceInteractive} />
        </Animated.View>
        {destinations.map(({ Icon, label, route }, index) => {
          const isActive = index === selectedIndex;
          return (
            <Pressable
              accessibilityLabel={label}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              key={route}
              onPress={() => {
                if (index === selectedIndex) return;
                setPendingIndex(index);
                void Haptics.selectionAsync();
                goTo(route as Href);
              }}
              style={styles.item}
            >
              <Icon color={isActive ? colors.brand : colors.textMuted} size={20} strokeWidth={isActive ? 2.4 : 2} />
              <Text color={isActive ? "primary" : "muted"} style={isActive ? styles.activeLabel : undefined} variant="caption">{label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    borderWidth: StyleSheet.hairlineWidth,
    boxShadow: "0 12px 32px rgba(0, 0, 0, 0.32)",
    flexDirection: "row",
    maxWidth: 420,
    overflow: "hidden",
    width: "100%",
  },
  host: {
    alignItems: "center",
    bottom: 0,
    left: 0,
    paddingHorizontal: 16,
    position: "absolute",
    right: 0,
    zIndex: 80,
  },
  indicator: {
    borderWidth: StyleSheet.hairlineWidth,
    bottom: BAR_PADDING,
    overflow: "hidden",
    position: "absolute",
  },
  item: {
    alignItems: "center",
    flex: 1,
    gap: 3,
    justifyContent: "center",
    minHeight: 54,
  },
  activeLabel: { fontFamily: "Manrope_700Bold" },
});
