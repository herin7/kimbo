import { useId } from "react";
import { StyleSheet } from "react-native";
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from "react-native-svg";

export interface SurfaceGradientProps {
  /** Top-left (linear) or centre (radial) colour. Hex or rgba(). */
  from: string;
  to: string;
  variant?: "diagonal" | "vertical" | "radial";
  /** Radial only: centre of the glow, as fractions of the surface. */
  center?: { x: number; y: number };
  /** Only needed when the parent does not clip; keep it at most half the surface height. */
  borderRadius?: number;
}

/** SVG stops drop the alpha inside rgba() on Android, so it is passed as stopOpacity instead. */
function toStop(color: string): { stopColor: string; stopOpacity: number } {
  const match = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/i.exec(color);
  if (!match) return { stopColor: color, stopOpacity: 1 };
  const [, r, g, b, a] = match;
  return { stopColor: `rgb(${r}, ${g}, ${b})`, stopOpacity: a === undefined ? 1 : Number(a) };
}

/**
 * A quiet background wash that sits behind a surface's content. Keep stops close in value:
 * the goal is depth and colour blending, not a visible gradient.
 */
export function SurfaceGradient({ borderRadius = 0, center = { x: 0.85, y: 0.1 }, from, to, variant = "diagonal" }: SurfaceGradientProps) {
  const id = `g${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  return (
    <Svg pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Defs>
        {variant === "radial" ? (
          <RadialGradient cx={center.x} cy={center.y} gradientUnits="objectBoundingBox" id={id} r={0.9}>
            <Stop offset={0} {...toStop(from)} />
            <Stop offset={1} {...toStop(to)} />
          </RadialGradient>
        ) : (
          <LinearGradient id={id} x1={0} x2={variant === "vertical" ? 0 : 1} y1={0} y2={1}>
            <Stop offset={0} {...toStop(from)} />
            <Stop offset={1} {...toStop(to)} />
          </LinearGradient>
        )}
      </Defs>
      <Rect fill={`url(#${id})`} height="100%" rx={borderRadius} ry={borderRadius} width="100%" />
    </Svg>
  );
}
