import { Group, Progress, Stack, Text, ThemeIcon } from "@mantine/core";
import { ReactNode } from "react";
import { GlassCard, type GlassCardProps } from "./GlassCard";

type PulseItem = {
  label: ReactNode;
  value: ReactNode;
  /** Optional progress percentage (0-100). When provided, a progress bar is shown instead of plain text value. */
  progress?: number;
  /** Color for progress bar or accent, defaults to 'blue'. */
  color?: string;
  /** Insert a subtle divider after this item. */
  divider?: boolean;
};

type PulseCardProps = Omit<GlassCardProps, "children"> & {
  title: ReactNode;
  icon: React.ComponentType<{ size?: number }>;
  description?: ReactNode;
  items: PulseItem[];
  iconColor?: string;
  minWidth?: number;
};

export function PulseCard({
  title,
  icon: Icon,
  description,
  items,
  iconColor = "indigo",
  minWidth = 260,
  shadow,
  ...cardProps
}: PulseCardProps) {
  const dividerStyle = {
    margin: "4px 0 0",
    border: "none",
    borderTop: "1px solid var(--mantine-color-gray-3)",
    opacity: 0.12,
  };

  return (
    <GlassCard
      radius="lg"
      p="md"
      shadow={shadow ?? "0 10px 30px -22px rgba(0,0,0,0.35)"}
      style={{ minWidth, ...(cardProps.style || {}) }}
      {...cardProps}
    >
      <Stack gap="sm">
        <Group gap="xs">
          <ThemeIcon variant="light" color={iconColor} radius="xl">
            <Icon size={16} />
          </ThemeIcon>
          <Text fw={600}>{title}</Text>
        </Group>
        {description && (
          <Text size="xs" c="dimmed">
            {description}
          </Text>
        )}

        {items.map((item, idx) => (
          <Stack key={idx} gap={item.progress !== undefined ? 4 : 3}>
            <Group justify="space-between">
              <Text size="xs" c="dimmed">
                {item.label}
              </Text>
              {item.progress === undefined && (
                <Text size="xs" fw={600}>
                  {item.value}
                </Text>
              )}
            </Group>
            {item.progress !== undefined && (
              <Progress value={item.progress} radius="xl" size="xs" color={item.color ?? "blue"} />
            )}
            {item.divider && idx < items.length - 1 && (
              <hr style={dividerStyle} />
            )}
          </Stack>
        ))}
      </Stack>
    </GlassCard>
  );
}

PulseCard.displayName = "PulseCard";
