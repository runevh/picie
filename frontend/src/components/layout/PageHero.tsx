import { Group, Stack, Text } from "@mantine/core";
import { ReactNode } from "react";
import { GlassCard, type GlassCardProps } from "./GlassCard";

type PageHeroProps = Omit<GlassCardProps, "children"> & {
  badge?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  meta?: ReactNode;
  footer?: ReactNode;
  /** Right-side element (stats card, illustration, etc.). */
  aside?: ReactNode;
  /** Max width for the main content stack. */
  mainMaxWidth?: number | string;
};

export function PageHero({
  badge,
  title,
  description,
  actions,
  meta,
  footer,
  aside,
  mainMaxWidth = 640,
  ...cardProps
}: PageHeroProps) {
  const renderDescription =
    typeof description === "string" ? (
      <Text c="dimmed" size="sm">
        {description}
      </Text>
    ) : (
      description
    );

  return (
    <GlassCard {...cardProps}>
      <Group align="flex-start" justify="space-between" wrap="wrap" gap="xl">
        <Stack gap="md" maw={mainMaxWidth}>
          {badge}
          {title}
          {renderDescription}
          {actions}
          {meta}
          {footer}
        </Stack>
        {aside}
      </Group>
    </GlassCard>
  );
}

PageHero.displayName = "PageHero";
