import { Box, BoxProps, useComputedColorScheme } from "@mantine/core";
import { forwardRef, ReactNode } from "react";

type BackgroundProps = BoxProps & {
  /**
   * When true, force the background container to span the full viewport height.
   * Useful for standalone pages like login where the content should center vertically.
   */
  fullHeight?: boolean;
  children?: ReactNode;
};

export const Background = forwardRef<HTMLDivElement, BackgroundProps>(
  ({ children, fullHeight = false, style, ...rest }, ref) => {
    const computedColorScheme = useComputedColorScheme("light", { getInitialValueInEffect: true });
    const isDark = computedColorScheme === "dark";

    const shellBackground = isDark
      ? [
        "radial-gradient(1200px at 18% 22%, rgba(59, 130, 246, 0.14), transparent 52%)",
        "radial-gradient(1400px at 78% 28%, rgba(232, 121, 249, 0.10), transparent 54%)",
        "radial-gradient(1300px at 48% 68%, rgba(34, 197, 94, 0.10), transparent 56%)",
        "linear-gradient(135deg, #050a14 0%, #0a1325 42%, #040a17 100%)",
      ].join(",")
      : [
        "radial-gradient(1200px at 20% 24%, rgba(59, 130, 246, 0.18), transparent 52%)",
        "radial-gradient(1400px at 80% 30%, rgba(232, 121, 249, 0.12), transparent 54%)",
        "radial-gradient(1300px at 50% 72%, rgba(34, 197, 94, 0.12), transparent 56%)",
        "linear-gradient(135deg, #f6fbff 0%, #ecf2ff 42%, #e5efff 78%)",
      ].join(",");

    return (
      <Box
        ref={ref}
        {...rest}
        style={{
          background: shellBackground,
          backgroundSize: "130% 130%",
          backgroundPosition: "18% 38%",
          backgroundAttachment: "fixed",
          animation: "bgShift 70s ease-in-out infinite",
          minHeight: fullHeight ? "100vh" : undefined,
          width: "100%",
          ...style,
        }}
      >
        {children}
      </Box>
    );
  }
);

Background.displayName = "Background";
