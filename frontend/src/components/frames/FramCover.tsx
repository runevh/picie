import { Card, Stack, Group, Text, Tooltip, Badge, Box, ThemeIcon } from "@mantine/core";
import { Frame } from "./Frame.types";
import { IconClock, IconPhoto, IconUsers, IconWifi, IconWifiOff } from "@tabler/icons-react";
import { useMemo } from "react";
import { useIsMobile } from "../../util/LayoutUtil";

type FrameCoverProps = {
  frame: Frame;
  onClick?: (frame: Frame) => void;
};

const scheduleLabelMap: Record<Frame["refreshSchedule"], string> = {
  "hourly": "Next in ~1h",
  "four-hours": "Next in ~4h",
  "daily-midnight": "Midnight refresh",
  "daily-morning": "8 AM refresh",
};

export function FrameCover({ frame, onClick }: FrameCoverProps) {
  const isMobile = useIsMobile();
  const shareCount = frame.sharedWith?.length ?? 0;
  const scheduleLabel = scheduleLabelMap[frame.refreshSchedule];

  const statusBadge = useMemo(
    () =>
      frame.status === "online" ? (
        <Badge
          size="sm"
          leftSection={<IconWifi size={14} />}
          color="green"
          variant="light"
        >
          Online
        </Badge>
      ) : (
        <Badge
          size="sm"
          leftSection={<IconWifiOff size={14} />}
          color="gray"
          variant="light"
        >
          Offline
        </Badge>
      ),
    [frame.status]
  );

  return (
    <Card
      withBorder
      radius="lg"
      padding={0}
      shadow="sm"
      style={{
        cursor: "pointer",
        overflow: "hidden",
        width: "100%",
        maxWidth: isMobile ? "100%" : 360,
      }}
      onClick={() => onClick?.(frame)}
    >
      <Box
        style={{
          position: "relative",
          width: "100%",
          paddingBottom: "60%",
          backgroundImage: `url(${frame.activeImage})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <Box
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(180deg, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.8) 100%)",
          }}
        />
        <Stack
          gap={6}
          style={{
            position: "absolute",
            inset: 16,
            color: "white",
            height: "calc(100% - 32px)",
            justifyContent: "space-between",
          }}
        >
          <Group justify="space-between" gap="xs">
            {statusBadge}
            {shareCount > 0 && (
              <Tooltip label={`Shared with ${shareCount} ${shareCount === 1 ? "person" : "people"}`}>
                <Badge
                  size="sm"
                  leftSection={<IconUsers size={14} />}
                  variant="outline"
                  color="white"
                  style={{ color: "white", borderColor: "rgba(255,255,255,0.5)" }}
                >
                  {shareCount}
                </Badge>
              </Tooltip>
            )}
          </Group>
          <Stack gap={4}>
            <Text fw={600} size="lg" lineClamp={1}>
              {frame.name}
            </Text>
            <Text size="sm" c="gray.3" lineClamp={1}>
              {frame.description || "No description yet"}
            </Text>
            <Group gap="xs">
              <ThemeIcon size="sm" variant="light" color="gray" radius="xl">
                <IconPhoto size={14} />
              </ThemeIcon>
              <Text size="sm">{frame.currentAlbum || "No album selected"}</Text>
            </Group>
          </Stack>
        </Stack>
      </Box>

      <Stack gap="xs" p="md">
        <Group justify="space-between" gap="xs">
          <Group gap={6}>
            <IconClock size={16} color="var(--mantine-color-dimmed)" />
            <Text size="sm" c="dimmed">
              {scheduleLabel}
            </Text>
          </Group>
          <Text size="xs" c="dimmed">
            Tap to edit
          </Text>
        </Group>
      </Stack>
    </Card>
  );
}
