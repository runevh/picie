import { Card, Stack, Group, Text, Tooltip, Badge, Box, ThemeIcon } from "@mantine/core";
import { Frame } from "./Frame.types";
import { IconPhoto, IconUsers, IconWifi, IconWifiOff } from "@tabler/icons-react";
import { useMemo } from "react";
import { useIsMobile } from "../../util/LayoutUtil";

type FrameCoverProps = {
  frame: Frame;
  onClick?: (frame: Frame) => void;
};

export function FrameCover({ frame, onClick }: FrameCoverProps) {
  const isMobile = useIsMobile();
  const shareCount = frame.sharedWith?.length ?? 0;
  const coverImage =
    frame.activeImage ||
    "linear-gradient(135deg, #0f172a 0%, #1e293b 35%, #334155 100%)";
  const albumLabel = frame.album?.name || frame.currentAlbum || "No album selected";

  const statusBadge = useMemo(() => {
    switch (frame.status) {
      case "online":
        return (
          <Badge size="sm" leftSection={<IconWifi size={14} />} color="green" variant="light">
            Online
          </Badge>
        );
      case "updating":
      case "updating_frame":
        return (
          <Badge size="sm" color="blue" variant="light">
            Updating frame…
          </Badge>
        );
      case "pairing":
        return (
          <Badge size="sm" color="yellow" variant="light">
            Pairing
          </Badge>
        );
      case "error":
        return (
          <Badge size="sm" color="red" variant="light">
            Error
          </Badge>
        );
      default:
        return (
          <Badge size="sm" leftSection={<IconWifiOff size={14} />} color="gray" variant="light">
            Offline
          </Badge>
        );
    }
  }, [frame.status]);

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
          backgroundImage: coverImage.startsWith("linear-gradient")
            ? coverImage
            : `url(${coverImage})`,
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
          <Group justify="flex-end" gap="xs">
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
          <Group justify="space-between" align="flex-end" gap="md">
            <Stack gap={4} style={{ flex: 1, minWidth: 0 }}>
              <Text fw={600} size="lg" lineClamp={1}>
                {frame.name}
              </Text>
              <Group gap="xs">
                <ThemeIcon size="sm" variant="light" color="gray" radius="xl">
                  <IconPhoto size={14} />
                </ThemeIcon>
                <Text size="sm" lineClamp={1}>{albumLabel}</Text>
              </Group>
            </Stack>
            <Box style={{ alignSelf: "flex-end" }}>
              {statusBadge}
            </Box>
          </Group>
        </Stack>
      </Box>

    </Card>
  );
}
