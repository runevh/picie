import {
  Badge,
  Box,
  Button,
  Card,
  Divider,
  Drawer,
  Group,
  Image,
  Modal,
  Paper,
  ScrollArea,
  Select,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { useEffect, useMemo, useState } from "react";
import { Frame } from "./Frame.types";
import { IconClock, IconWifi, IconWifiOff } from "@tabler/icons-react";
import { useIsMobile } from "../../util/LayoutUtil";
import { usePhoto } from "../../contexts/PhotoContext";
import { getUrlFromPhoto } from "../../util/UrlUtil";

type FrameDetailModalProps = {
  frame: Frame;
  opened: boolean;
  onClose: () => void;
  onSave: (frame: Frame) => void;
};

export function FrameDetailModal({ frame, opened, onClose, onSave }: FrameDetailModalProps) {
  const isMobile = useIsMobile();
  const { albums } = usePhoto();
  const [name, setName] = useState(frame.name);
  const [activeAlbum, setActiveAlbum] = useState<string | null>(frame.currentAlbum);
  const [refreshSchedule, setRefreshSchedule] = useState(frame.refreshSchedule);

  useEffect(() => {
    setName(frame.name);
    setActiveAlbum(frame.currentAlbum);
    setRefreshSchedule(frame.refreshSchedule);
  }, [frame.id, frame.name, frame.currentAlbum, frame.refreshSchedule]);

  const albumOptions = useMemo(
    () => albums.map((album) => ({ value: album.id, label: album.name || "Untitled album" })),
    [albums]
  );

  const selectedAlbum = useMemo(
    () => albums.find((album) => album.id === activeAlbum) ?? null,
    [albums, activeAlbum]
  );

  const selectedAlbumLabel =
    albumOptions.find((option) => option.value === activeAlbum)?.label || "No album selected";

  const statusBadge =
    frame.status === "online" ? (
      <Badge color="green" leftSection={<IconWifi size={14} />} variant="light">
        Online
      </Badge>
    ) : (
      <Badge color="red" leftSection={<IconWifiOff size={14} />} variant="light">
        Offline
      </Badge>
    );

  const handleSave = () => {
    onSave({ ...frame, name, currentAlbum: activeAlbum, refreshSchedule });
  };

  const albumPreviewSrc =
    selectedAlbum && selectedAlbum.photos.length > 0
      ? getUrlFromPhoto(selectedAlbum.photos[0])
      : frame.activeImage;

  const sharedWithContent =
    frame.sharedWith && frame.sharedWith.length > 0 ? (
      <Stack gap={4}>
        {frame.sharedWith.map((email) => (
          <Badge key={email} variant="outline" size="sm" radius="sm">
            {email}
          </Badge>
        ))}
      </Stack>
    ) : (
      <Text c="dimmed" size="sm">
        Not shared yet
      </Text>
    );

  const headerImage = (
    <Box
      style={{
        position: "relative",
        width: "100%",
        aspectRatio: "16 / 9",
        borderRadius: 16,
        overflow: "hidden",
        backgroundColor: "#111",
        backgroundImage: `url(${frame.activeImage})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <Box
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(180deg, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.55) 100%)",
        }}
      />
      <Stack
        style={{
          position: "absolute",
          bottom: 16,
          left: 16,
          right: 16,
          color: "white",
        }}
        gap={4}
      >
        <Group gap="xs">
          {statusBadge}
          <Badge
            leftSection={<IconClock size={14} />}
            variant="white"
            color="dark"
            style={{ textTransform: "none" }}
          >
            Now playing
          </Badge>
        </Group>
        <Text fw={600} size="lg">
          {frame.name}
        </Text>
        <Text size="sm" c="gray.2">
          {selectedAlbumLabel}
        </Text>
      </Stack>
    </Box>
  );

  const scheduleOptions: { value: Frame["refreshSchedule"]; label: string }[] = [
    { value: "hourly", label: "Every hour" },
    { value: "four-hours", label: "Every 4 hours" },
    { value: "daily-midnight", label: "Daily at midnight" },
    { value: "daily-morning", label: "Daily at 8 AM" },
  ];

  const content = (
    <Stack gap="lg" p="md" style={{ minHeight: isMobile ? "100%" : "auto" }}>
      {headerImage}
      <Stack gap="sm">
        <TextInput
          label="Frame name"
          value={name}
          onChange={(event) => setName(event.currentTarget.value)}
        />

        <Select
          label="Active album"
          placeholder="Choose an album"
          data={albumOptions}
          value={activeAlbum}
          onChange={setActiveAlbum}
          searchable
          nothingFound="No albums yet"
        />
        {activeAlbum ? (
          <Card withBorder padding="sm" radius="md">
            <Group gap="md" align="center" wrap="nowrap">
              <Image
                src={albumPreviewSrc}
                alt="Album preview"
                width={80}
                height={80}
                radius="md"
                style={{ objectFit: "cover", flexShrink: 0 }}
              />
              <Stack gap={2} style={{ minWidth: 0 }}>
                <Text fw={600} size="sm" lineClamp={1}>
                  {selectedAlbumLabel}
                </Text>
                <Text size="xs" c="dimmed">
                  {selectedAlbum ? `${selectedAlbum.photos.length} photo${selectedAlbum.photos.length === 1 ? "" : "s"}` : "Album details unavailable"}
                </Text>
                <Text size="xs" c="dimmed">
                  Preview uses the first photo in this album.
                </Text>
              </Stack>
            </Group>
          </Card>
        ) : (
          <Paper withBorder radius="md" p="sm">
            <Text size="sm" c="dimmed">
              Select an album to see a quick preview of what the frame will show.
            </Text>
          </Paper>
        )}
      </Stack>

      <Box>
        <Text fw={500} mb={4}>
          Shared access
        </Text>
        {sharedWithContent}
      </Box>

      <Divider label="Device insights" labelPosition="center" />
      <Group gap="md" wrap="wrap">
        <Metric label="Next photo" value={describeNextPhoto(refreshSchedule)} />
        <Metric label="Last seen" value={frame.status === "online" ? "Moments ago" : "5 mins ago"} />
        <Metric label="Wi-Fi connection" value={frame.status === "online" ? "Connected" : "Searching..."} />
      </Group>

      <Divider label="Playback schedule" labelPosition="center" />

      <Stack gap="xs">
        <Select
          label="Change photo"
          data={scheduleOptions}
          value={refreshSchedule}
          onChange={(value) =>
            setRefreshSchedule((prev) => (value as Frame["refreshSchedule"]) || prev)
          }
        />
        <Text size="sm" c="dimmed">
          Choose how often the frame should pull a new image. This can later be synced with real device settings.
        </Text>
      </Stack>

      <Group justify="flex-end" mt="auto">
        <Button variant="default" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={handleSave}>Save changes</Button>
      </Group>
    </Stack>
  );

  if (isMobile) {
    return (
      <Drawer
        opened={opened}
        onClose={onClose}
        position="bottom"
        size="100%"
        padding="md"
        scrollAreaComponent={ScrollArea.Autosize}
        title="Frame details"
      >
        {content}
      </Drawer>
    );
  }

  return (
    <Modal opened={opened} onClose={onClose} size="lg" radius="lg" withCloseButton={false}>
      <ScrollArea h={600}>{content}</ScrollArea>
    </Modal>
  );
}

const describeNextPhoto = (schedule: Frame["refreshSchedule"]): string => {
  switch (schedule) {
    case "hourly":
      return "In about 1 hour";
    case "four-hours":
      return "In ~4 hours";
    case "daily-midnight":
      return "Tonight at midnight";
    case "daily-morning":
      return "Tomorrow at 8 AM";
    default:
      return "Schedule TBD";
  }
};

type MetricProps = {
  label: string;
  value: string;
};

function Metric({ label, value }: MetricProps) {
  return (
    <Stack
      gap={2}
      p="sm"
      style={{
        border: "1px solid var(--mantine-color-gray-3)",
        borderRadius: 12,
        minWidth: 140,
        flex: "1 1 140px",
      }}
    >
      <Text size="xs" c="dimmed" tt="uppercase">
        {label}
      </Text>
      <Text fw={600}>{value}</Text>
    </Stack>
  );
}
