import { Group, Stack, Text, ThemeIcon } from "@mantine/core";
import { ReactNode } from "react";
import { GlassCard, type GlassCardProps } from "./GlassCard";

type MetricTileProps = Omit<GlassCardProps, "children"> & {
  label: ReactNode;
  value: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  highlight?: boolean;
};

export function MetricTile({
  label,
  value,
  description,
  icon,
  highlight = false,
  radius = "md",
  p = "md",
  ...cardProps
}: MetricTileProps) {
  return (
    <GlassCard
      radius={radius}
      p={p}
      surfaceColor={
        highlight
          ? cardProps.surfaceColor ??
            (cardProps.style as { background?: string } | undefined)?.background ??
            undefined
          : cardProps.surfaceColor
      }
      {...cardProps}
    >
      <Stack gap={6}>
        {(icon || label) && (
          <Group gap="xs">
            {icon && (
              <ThemeIcon variant="light" color="blue" size="sm">
                {icon}
              </ThemeIcon>
            )}
            <Text fw={600}>{label}</Text>
          </Group>
        )}
        <Text fw={600} size="xl">
          {value}
        </Text>
        {description && (
          <Text size="xs" c="dimmed">
            {description}
          </Text>
        )}
      </Stack>
    </GlassCard>
  );
}

MetricTile.displayName = "MetricTile";
