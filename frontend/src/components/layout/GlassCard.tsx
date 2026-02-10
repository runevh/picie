import { Box, Paper, PaperProps, useComputedColorScheme } from "@mantine/core";
import { ReactNode } from "react";

export type GlassCardProps = PaperProps & {
  /** Optional custom background color; defaults to theme-based glass surface. */
  surfaceColor?: string;
  /** Optional custom border color; defaults to theme-based glass border. */
  borderColor?: string;
  /** Optional custom shadow; defaults to a soft lift based on theme. */
  shadow?: string;
  /** Overlay CSS background (e.g., gradients) applied as an inset layer. */
  overlay?: string | ReactNode;
  /** Blur amount applied to the card backdrop. */
  blur?: number;
  /** Content to render inside the card. */
  children?: ReactNode;
};

export function GlassCard({
  children,
  surfaceColor,
  borderColor,
  shadow,
  overlay,
  blur = 10,
  radius = "xl",
  p = "xl",
  withBorder = true,
  style,
  ...rest
}: GlassCardProps) {
  const computedColorScheme = useComputedColorScheme("light", { getInitialValueInEffect: true });
  const isDark = computedColorScheme === "dark";

  const surface = surfaceColor ?? (isDark ? "rgba(20, 24, 35, 0.9)" : "rgba(255,255,255,0.92)");
  const border = borderColor ?? (isDark ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.4)");
  const defaultShadow = isDark
    ? "0 30px 120px -70px rgba(0,0,0,0.75)"
    : "0 30px 120px -60px rgba(15, 23, 42, 0.5)";

  return (
    <Paper
      withBorder={withBorder}
      radius={radius}
      p={p}
      style={{
        position: "relative",
        overflow: "hidden",
        background: surface,
        borderColor: border,
        boxShadow: shadow ?? defaultShadow,
        backdropFilter: `blur(${blur}px)`,
        ...style,
      }}
      {...rest}
    >
      {typeof overlay === "string" ? (
        <Box
          style={{
            position: "absolute",
            inset: 0,
            background: overlay,
            pointerEvents: "none",
          }}
        />
      ) : (
        overlay
      )}
      <Box style={{ position: "relative", zIndex: 1 }}>{children}</Box>
    </Paper>
  );
}

GlassCard.displayName = "GlassCard";
