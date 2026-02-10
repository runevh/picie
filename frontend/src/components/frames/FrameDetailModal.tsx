import {
  Badge,
  Box,
  Button,
  Divider,
  Drawer,
  Group,
  Image,
  Modal,
  NumberInput,
  Paper,
  ScrollArea,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  useComputedColorScheme,
} from "@mantine/core";
import { TimePicker } from "@mantine/dates";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Frame } from "./Frame.types";
import { IconClock, IconPencil, IconPhoto, IconWifi, IconWifiOff, IconX } from "@tabler/icons-react";
import { useIsMobile } from "../../util/LayoutUtil";
import { usePhoto } from "../../contexts/PhotoContext";
import { getUrlFromPhoto } from "../../util/UrlUtil";
import { BackgroundModal } from "../layout/BackgroundModal";

const drawerSafeAreaStyles = {
  content: { paddingTop: "var(--safe-area-top)" },
  header: { paddingTop: "var(--safe-area-top)" },
} as const;

const normalizeTimeValue = (value: string) => {
  if (typeof value !== "string") return null;
  const trimmed = (value || "").trim();
  const match = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hours = Math.min(23, Math.max(0, parseInt(match[1], 10) || 0));
  const minutes = Math.min(59, Math.max(0, parseInt(match[2], 10) || 0));
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
};

const sortAndNormalizeTimes = (times: string[]) =>
  Array.from(
    new Set(
      times
        .map((t) => normalizeTimeValue(t))
        .filter((t): t is string => Boolean(t))
    )
  ).sort();

const dateToTimeString = (value: Date | string | null) => {
  if (!value) return "";
  if (value instanceof Date) {
    return `${String(value.getHours()).padStart(2, "0")}:${String(value.getMinutes()).padStart(2, "0")}`;
  }
  return normalizeTimeValue(value) || "";
};

const timeStringToDate = (value: string | null | undefined) => {
  const normalized = normalizeTimeValue(value || "");
  if (!normalized) return null;
  const [hours, minutes] = normalized.split(":").map((v) => parseInt(v, 10) || 0);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date;
};

type FrameDetailModalProps = {
  frame: Frame;
  opened: boolean;
  liveFrame?: Frame | null;
  onClose: () => void;
  onSave: (
    frame: Frame,
    options: {
      schedule: { mode: "interval" | "times"; intervalMinutes: number; timesOfDay: string[] };
      closeAfterSave?: boolean;
    }
  ) => void;
  onUnlink: (frame: Frame) => Promise<void>;
};

export function FrameDetailModal({ frame, liveFrame, opened, onClose, onSave, onUnlink }: FrameDetailModalProps) {
  const isMobile = useIsMobile();
  const computedColorScheme = useComputedColorScheme("light", { getInitialValueInEffect: true });
  const isDark = computedColorScheme === "dark";
  const surface = isDark ? "rgba(20,24,35,0.9)" : "rgba(255,255,255,0.92)";
  const surfaceBorder = isDark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.12)";
  const mobilePadding = isMobile ? "sm" : "md";
  const { albums } = usePhoto();
  const defaultTimes = frame.timesOfDay && frame.timesOfDay.length > 0 ? frame.timesOfDay : ["02:00", "14:00"];
  const [name, setName] = useState(frame.name);
  const [activeAlbum, setActiveAlbum] = useState<string | null>(frame.currentAlbum ?? frame.album?.id ?? null);
  const [refreshSchedule, setRefreshSchedule] = useState<Frame["refreshSchedule"]>(frame.refreshSchedule || "hourly");
  const [unlinking, setUnlinking] = useState(false);
  const [albumModalOpen, setAlbumModalOpen] = useState(false);
  const [albumSearch, setAlbumSearch] = useState("");
  const [confirmUnlinkOpen, setConfirmUnlinkOpen] = useState(false);
  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false);
  const [albumDetailOpen, setAlbumDetailOpen] = useState(false);
  const [updateMode, setUpdateMode] = useState<"interval" | "times">(frame.scheduleMode || "interval");
  const [intervalMinutes, setIntervalMinutes] = useState(frame.intervalMinutes || 60);
  const [timesOfDay, setTimesOfDay] = useState<string[]>(sortAndNormalizeTimes(defaultTimes));
  const [initialName, setInitialName] = useState(frame.name);
  const [initialAlbumId, setInitialAlbumId] = useState<string | null>(frame.currentAlbum ?? frame.album?.id ?? null);
  const [initialScheduleMode, setInitialScheduleMode] = useState<"interval" | "times">(frame.scheduleMode || "interval");
  const [initialIntervalMinutes, setInitialIntervalMinutes] = useState(frame.intervalMinutes || 60);
  const [initialTimesNormalized, setInitialTimesNormalized] = useState<string[]>(sortAndNormalizeTimes(defaultTimes));
  const liveForFrame = liveFrame && liveFrame.id === frame.id ? liveFrame : null;
  const liveStatus = liveForFrame?.status ?? frame.status;
  const liveLastSeen = liveForFrame?.lastSeen ?? frame.lastSeen;
  const liveActiveImage = liveForFrame?.activeImage ?? frame.activeImage;
  const liveCurrentPhotoId = liveForFrame?.currentPhotoId ?? frame.currentPhotoId;
  const liveNextPhotoId = liveForFrame?.nextPhotoId ?? frame.nextPhotoId;
  const liveNextUpdate = liveForFrame?.nextUpdate ?? frame.nextUpdate;
  const liveNextUpdateAt = (liveForFrame as any)?.nextUpdateAt ?? (frame as any).nextUpdateAt ?? null;
  const [newTime, setNewTime] = useState(timesOfDay[0] || "08:00");
  const timePillSize = isMobile ? "compact-xs" : "compact-sm";
  const timePillHeight = isMobile ? 32 : 36;
  const currentTimesNormalized = useMemo(() => sortAndNormalizeTimes(timesOfDay), [timesOfDay]);
  const hasUnsavedChanges = useMemo(() => {
    const nameChanged = name !== initialName;
    const albumChanged = (activeAlbum || null) !== (initialAlbumId || null);
    const scheduleModeChanged = updateMode !== initialScheduleMode;
    const intervalChanged = intervalMinutes !== initialIntervalMinutes;
    const timesChanged = currentTimesNormalized.join(",") !== initialTimesNormalized.join(",");
    return nameChanged || albumChanged || scheduleModeChanged || intervalChanged || timesChanged;
  }, [
    activeAlbum,
    currentTimesNormalized,
    initialAlbumId,
    initialIntervalMinutes,
    initialScheduleMode,
    initialTimesNormalized,
    intervalMinutes,
    name,
    updateMode,
  ]);

  const requestClose = () => {
    if (hasUnsavedChanges) {
      setConfirmCloseOpen(true);
      return;
    }
    onClose();
  };

  const handleConfirmDiscard = () => {
    setConfirmCloseOpen(false);
    onClose();
  };

  const prevFrameIdRef = useRef(frame.id);

  useEffect(() => {
    const nextTimes = frame.timesOfDay && frame.timesOfDay.length > 0 ? frame.timesOfDay : ["02:00", "14:00"];
    const normalized = sortAndNormalizeTimes(nextTimes);
    const shouldReset = frame.id !== prevFrameIdRef.current || !hasUnsavedChanges;

    if (shouldReset) {
      setName(frame.name);
      setInitialName(frame.name);
      const nextAlbum = frame.currentAlbum ?? frame.album?.id ?? null;
      setActiveAlbum(nextAlbum);
      setInitialAlbumId(nextAlbum);
      setRefreshSchedule(frame.refreshSchedule || deriveScheduleLabel(frame));
      setAlbumSearch("");
      setAlbumModalOpen(false);
      const nextMode: "interval" | "times" = frame.scheduleMode || "interval";
      setUpdateMode(nextMode);
      setInitialScheduleMode(nextMode);
      const nextInterval = frame.intervalMinutes || 60;
      setIntervalMinutes(nextInterval);
      setInitialIntervalMinutes(nextInterval);
      setTimesOfDay(normalized);
      setInitialTimesNormalized(normalized);
      setNewTime(normalized[0] || "08:00");
      setConfirmCloseOpen(false);
      prevFrameIdRef.current = frame.id;
    }
  }, [frame, hasUnsavedChanges]);

  const albumOptions = useMemo(
    () => albums.map((album) => ({ value: album.id, label: album.name || "Untitled album" })),
    [albums]
  );
  const availableAlbums = useMemo(() => albums.filter((album) => album.id !== activeAlbum), [albums, activeAlbum]);
  const filteredAlbums = useMemo(() => {
    const term = albumSearch.trim().toLowerCase();
    if (!term) return availableAlbums;
    return availableAlbums.filter((album) => (album.name || "untitled album").toLowerCase().includes(term));
  }, [availableAlbums, albumSearch]);

  const selectedAlbum = useMemo(
    () => albums.find((album) => album.id === activeAlbum) ?? null,
    [albums, activeAlbum]
  );
  const displayAlbum = selectedAlbum || (frame.album ? { id: frame.album.id, name: frame.album.name || "Untitled album", photos: [] } : null);

  const selectedAlbumLabel =
    albumOptions.find((option) => option.value === activeAlbum)?.label ||
    frame.album?.name ||
    (frame.album?.id ? `Album ${frame.album.id}` : "No album selected");

  const getAlbumPreview = (album: typeof selectedAlbum | typeof displayAlbum) =>
    album && album.photos && album.photos.length > 0
      ? getUrlFromPhoto(album.photos[0])
      : liveActiveImage ||
        "linear-gradient(135deg, #0f172a 0%, #1e293b 35%, #334155 100%)";

  const statusBadge =
    liveStatus === "online" ? (
      <Badge color="green" leftSection={<IconWifi size={14} />} variant="light">
        Online
      </Badge>
    ) : liveStatus === "updating" || liveStatus === "updating_frame" ? (
      <Badge color="blue" variant="light">
        Updating frame…
      </Badge>
    ) : liveStatus === "pairing" ? (
      <Badge color="yellow" variant="light">
        Pairing
      </Badge>
    ) : liveStatus === "error" ? (
      <Badge color="red" variant="light">
        Error
      </Badge>
    ) : (
      <Badge color="red" leftSection={<IconWifiOff size={14} />} variant="light">
        Offline
      </Badge>
    );

  const handleSave = (closeAfterSave = true) => {
    onSave(
      { ...frame, name, currentAlbum: activeAlbum, refreshSchedule },
      {
        schedule: {
          mode: updateMode,
          intervalMinutes,
          timesOfDay,
        },
        closeAfterSave,
      }
    );
  };

  const handleUnlink = async () => {
    setUnlinking(true);
    try {
      await onUnlink(frame);
    } finally {
      setUnlinking(false);
      setConfirmUnlinkOpen(false);
    }
  };

  const modalSurfaceStyles = {
    content: {
      background: surface,
      border: `1px solid ${surfaceBorder}`,
      boxShadow: isDark ? "0 18px 60px -45px rgba(0,0,0,0.7)" : "0 18px 60px -40px rgba(15,23,42,0.32)",
    },
    body: { background: "transparent" },
    header: { background: "transparent" },
  } as const;

  const drawerSurfaceStyles = {
    ...modalSurfaceStyles,
    content: {
      ...modalSurfaceStyles.content,
      paddingTop: "var(--safe-area-top)",
    },
    header: {
      ...modalSurfaceStyles.header,
      paddingTop: "var(--safe-area-top)",
    },
  } as const;

  const headerImage = (
    <Box
      style={{
        position: "relative",
        width: "100%",
        aspectRatio: "16 / 9",
        borderRadius: 16,
        overflow: "hidden",
        backgroundColor: "#111",
        backgroundImage: liveActiveImage
          ? `url(${liveActiveImage})`
          : "linear-gradient(135deg, #0f172a 0%, #1e293b 35%, #334155 100%)",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <Box
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(180deg, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.8) 100%)",
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
        <Group justify="space-between" align="flex-end" gap="md">
          <Stack gap={4} style={{ flex: 1, minWidth: 0, alignItems: "flex-start", width: "100%" }}>
            <Text fw={600} size="lg" lineClamp={1} ta="left">
              {frame.name}
            </Text>
            <Text size="sm" c="gray.2" lineClamp={1} ta="left">
              {selectedAlbumLabel}
            </Text>
          </Stack>
          <Box style={{ alignSelf: "flex-end" }}>
            {statusBadge}
          </Box>
        </Group>
      </Stack>
    </Box>
  );

  const albumPhotos = displayAlbum?.photos || [];
  const resolvePhotoById = (id?: string | number | null) => {
    if (!id) return null;
    const match = albumPhotos.find((p) => String(p.id) === String(id));
    return match || ({ id: String(id) } as any);
  };
  const lastSeenLabel = liveLastSeen
    ? new Date(liveLastSeen).toLocaleString()
    : liveStatus === "online"
      ? "Moments ago"
      : "Unknown";
  const frameStateLabel =
    liveStatus === "updating" || liveStatus === "updating_frame"
      ? "Updating"
      : liveStatus === "pairing"
        ? "Pairing"
        : liveStatus === "error"
          ? "Error"
          : liveStatus === "online"
            ? "Connected"
            : "Offline";
  const nextTriggerLabel = (() => {
    if (liveNextUpdate) {
      return String(liveNextUpdate);
    }
    const tsLabel = formatNextTriggerLabel({
      liveNextUpdate: liveNextUpdateAt,
      scheduleMode: updateMode,
      intervalMinutes,
      timesOfDay,
    });
    return tsLabel;
  })();

  const currentPhoto = resolvePhotoById(liveCurrentPhotoId);
  const nextPhoto = resolvePhotoById(liveNextPhotoId);
  const albumChanged = (activeAlbum || null) !== (initialAlbumId || null);

  const previewCurrentPhoto = albumChanged ? albumPhotos[0] || currentPhoto : currentPhoto;
  const previewNextPhoto =
    albumChanged ? albumPhotos[1] || albumPhotos[0] || nextPhoto || currentPhoto : nextPhoto;
  const currentTileLabel = albumChanged ? "Will show after saving" : "Current image";
  const nextTileLabel = albumChanged ? "Next up after saving" : "Next image";

  const nextUpdateText = nextTriggerLabel;

  const intervalHours = Math.floor(intervalMinutes / 60);
  const intervalMinutesPart = intervalMinutes % 60;

  const updateIntervalFromParts = (hours: number, minutes: number) => {
    const safeHours = Math.max(0, Math.floor(Number.isFinite(hours) ? hours : 0));
    const rawMinutes = Math.max(0, Math.floor(Number.isFinite(minutes) ? minutes : 0));
    const safeMinutes = safeHours === 0 ? Math.max(1, rawMinutes) : rawMinutes;
    setIntervalMinutes(safeHours * 60 + safeMinutes);
  };

  const handleHoursChange = (value: string | number | null) => {
    const parsed = typeof value === "number" ? value : parseInt(value || "0", 10);
    updateIntervalFromParts(parsed, intervalMinutesPart);
  };

  const handleMinutesChange = (value: string | number | null) => {
    const parsed = typeof value === "number" ? value : parseInt(value || "0", 10);
    updateIntervalFromParts(intervalHours, parsed);
  };

  const handleAddTime = () => {
    const normalized = normalizeTimeValue(newTime);
    if (!normalized) return;
    setTimesOfDay((prev) => (prev.includes(normalized) ? prev : sortAndNormalizeTimes([...prev, normalized])));
    setNewTime(normalized);
  };

  const handleRemoveTime = (time: string) => {
    setTimesOfDay((prev) => prev.filter((t) => t !== time));
  };

  const renderPhotoTile = (label: string, photo: { id: string } | null, fallback?: string) => {
    const src = photo ? getUrlFromPhoto(photo as any) : fallback || liveActiveImage;
    return (
      <Paper
        withBorder
        radius="md"
        p="xs"
        style={{ cursor: "pointer" }}
        onClick={() => setAlbumDetailOpen(true)}
      >
        <Stack gap={6}>
          <Text fw={600} size="sm">
            {label}
          </Text>
          <Box
            style={{
              position: "relative",
              width: "100%",
              paddingBottom: "70%",
              borderRadius: 10,
              overflow: "hidden",
              background: "var(--mantine-color-gray-1)",
            }}
          >
            {src ? (
              <Image
                src={src}
                alt={label}
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                }}
              />
            ) : (
              <Text size="xs" c="dimmed" style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
                No image
              </Text>
            )}
          </Box>
        </Stack>
      </Paper>
    );
  };

  const content = (
    <Stack
      gap="lg"
      p={mobilePadding}
      style={{ minHeight: isMobile ? "calc(100vh - 140px)" : "auto" }}
    >
      {headerImage}
      <Stack gap="sm">
        <TextInput
          label="Frame name"
          value={name}
          onChange={(event) => setName(event.currentTarget.value)}
        />

        <Divider label="Album" labelPosition="center" />
        <Stack gap="xs">
          <Paper withBorder radius="md" p="sm">
            <Stack gap="sm">
              <Group align="center" justify="space-between" wrap="nowrap">
                <Group align="center" gap="sm" wrap="nowrap" style={{ minWidth: 0, flex: 1 }}>
                  <Stack gap={2} style={{ minWidth: 0, width: "100%" }}>
                    <Text fw={600} size="sm" lineClamp={1}>
                      {displayAlbum?.name || selectedAlbumLabel}
                    </Text>
                    <Text size="xs" c="dimmed" lineClamp={2}>
                      {displayAlbum
                        ? `${albumPhotos.length} photo${albumPhotos.length === 1 ? "" : "s"} in this album.`
                        : "Pick an album to start showing photos on this frame."}
                    </Text>
                  </Stack>
                </Group>
                <Button
                  size="xs"
                  variant="outline"
                  leftSection={<IconPencil size={14} />}
                  onClick={() => setAlbumModalOpen(true)}
                >
                  Change
                </Button>
              </Group>

              <Box
                style={{
                  width: "100%",
                  minHeight: isMobile ? "38vh" : undefined,
                }}
              >
                {albumPhotos.length === 0 ? (
                  <Paper withBorder radius="md" p="sm">
                    <Stack gap={4}>
                      <Text fw={600} size="sm">
                        Images not available yet
                      </Text>
                      <Text size="sm" c="dimmed">
                        Add photos to this album to see the current and next image previews.
                      </Text>
                    </Stack>
                  </Paper>
                ) : (
                  <>
                    {albumChanged && (
                      <Text size="xs" c="dimmed" mb={4}>
                        This preview is based on the selected album and will apply once you save.
                      </Text>
                    )}
                  <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                    {renderPhotoTile(currentTileLabel, previewCurrentPhoto, liveActiveImage)}
                    {renderPhotoTile(nextTileLabel, previewNextPhoto)}
                  </SimpleGrid>
                  </>
                )}
              </Box>
            </Stack>
          </Paper>
        </Stack>
      </Stack>

      <Divider label="Playback schedule" labelPosition="center" />

      <Stack gap="xs">
        <SegmentedControl
          fullWidth
          color="gray"
          radius="xl"
          size="md"
          value={updateMode}
          onChange={(value) => setUpdateMode((value as "interval" | "times") || "interval")}
          data={[
            { label: "Regular interval", value: "interval" },
            { label: "Set times of day", value: "times" },
          ]}
          styles={{
            root: {
              backgroundColor: isDark ? "var(--mantine-color-dark-7)" : "var(--mantine-color-gray-0)",
              border: `1px solid ${isDark ? "var(--mantine-color-dark-4)" : "var(--mantine-color-gray-3)"}`,
            },
            indicator: {
              backgroundColor: isDark ? "var(--mantine-color-dark-4)" : "var(--mantine-color-gray-3)",
              boxShadow: isDark ? "0 0 0 1px var(--mantine-color-dark-4)" : "none",
            },
            label: { color: isDark ? "var(--mantine-color-gray-2)" : "var(--mantine-color-gray-7)" },
            labelActive: { color: isDark ? "var(--mantine-color-gray-0)" : "var(--mantine-color-dark-7)" },
          }}
        />

        {updateMode === "interval" ? (
          <Stack gap={4} w="100%">
            <Group gap="sm" grow align="flex-end" wrap="nowrap" w="100%">
              <NumberInput
                label="Hours"
                min={0}
                step={1}
                value={intervalHours}
                onChange={handleHoursChange}
                clampBehavior="strict"
              />
              <NumberInput
                label="Minutes"
                min={intervalHours === 0 ? 1 : 0}
                max={59}
                step={1}
                value={intervalMinutesPart}
                onChange={handleMinutesChange}
                clampBehavior="strict"
              />
            </Group>
            <Text size="xs" c="dimmed">
              Minimum interval is 1 minute.
            </Text>
          </Stack>
        ) : (
          <Stack gap="xs" w="100%">
            <Text size="sm" c="dimmed">
              Times of day
            </Text>
            {isMobile ? (
              <Stack gap={6} w="100%">
                {timesOfDay.length > 0 ? (
                  timesOfDay.map((time) => (
                    <Button
                      key={time}
                      fullWidth
                      size={timePillSize}
                      variant="light"
                      radius="md"
                      rightSection={<IconX size={14} />}
                      onClick={() => handleRemoveTime(time)}
                      style={{
                        justifyContent: "space-between",
                        height: timePillHeight,
                        paddingInline: 12,
                        fontSize: 13,
                      }}
                    >
                      At {time}
                    </Button>
                  ))
                ) : (
                  <Text size="sm" c="dimmed">
                    No times added yet.
                  </Text>
                )}
              </Stack>
            ) : (
              <Box
                w="100%"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  overflowX: "auto",
                  overflowY: "hidden",
                  paddingTop: 2,
                  paddingBottom: 8,
                  WebkitOverflowScrolling: "touch",
                  maxWidth: "100%",
                  whiteSpace: "nowrap",
                  minHeight: timePillHeight + 6,
                  maxHeight: timePillHeight + 10,
                }}
              >
                {timesOfDay.length > 0 ? (
                  timesOfDay.map((time) => (
                    <Button
                      key={time}
                      size={timePillSize}
                      variant="light"
                      radius="md"
                      rightSection={<IconX size={14} />}
                      onClick={() => handleRemoveTime(time)}
                      style={{
                        flexShrink: 0,
                        height: timePillHeight,
                        paddingInline: isMobile ? 10 : undefined,
                        fontSize: isMobile ? 12 : undefined,
                      }}
                    >
                      {time}
                    </Button>
                  ))
                ) : (
                  <Text size="sm" c="dimmed">
                    No times added yet.
                  </Text>
                )}
              </Box>
            )}
            <Group gap="xs" align="flex-end" wrap="nowrap" w="100%">
              <TimePicker
                withSeconds={false}
                format="24h"
                value={newTime}
                onChange={(value) => setNewTime(dateToTimeString(value) || "00:00")}
                maw={180}
              />

              <Button variant="filled" onClick={handleAddTime} style={{ alignSelf: "stretch" }}>
                Add
              </Button>
            </Group>
          </Stack>
        )}
      </Stack>

      <Stack gap="md" mt="auto">
        <Divider label="Device insights" labelPosition="center" />
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
          <InsightCard
            label="Next photo"
            value={nextTriggerLabel}
            hint="Scheduled display time"
            icon={<IconPhoto size={16} />}
            isDark={isDark}
          />
          <InsightCard
            label="Last seen"
            value={lastSeenLabel}
            hint={liveStatus === "online" ? "Frame is currently online" : "Last heartbeat from the frame"}
            icon={<IconClock size={16} />}
            isDark={isDark}
          />
          <InsightCard
            label="Frame state"
            value={frameStateLabel}
            hint={liveStatus === "online" ? "Ready for updates" : "Might need attention"}
            icon={<IconWifi size={16} />}
            isDark={isDark}
          />
          <InsightCard
            label="Album"
            value={selectedAlbumLabel}
            hint="Active album for this frame"
            icon={<IconPhoto size={16} />}
            isDark={isDark}
          />
        </SimpleGrid>

        <Group justify="flex-end">
          <Button variant="default" onClick={requestClose}>
            Cancel
          </Button>
          <Group gap="sm">
            <Button color="red" variant="light" onClick={() => setConfirmUnlinkOpen(true)}>
              Unlink
            </Button>
            <Button onClick={handleSave}>Save</Button>
          </Group>
        </Group>
      </Stack>
    </Stack>
  );

  const albumModal = (
    <AlbumPickerModal
      opened={albumModalOpen}
      onClose={() => {
        setAlbumModalOpen(false);
        setAlbumSearch("");
      }}
      albums={filteredAlbums}
      onSelect={(id) => {
        if (id === activeAlbum) {
          setAlbumModalOpen(false);
          setAlbumSearch("");
          return;
        }
        setActiveAlbum(id);
        setAlbumModalOpen(false);
        setAlbumSearch("");
      }}
      search={albumSearch}
      onSearch={setAlbumSearch}
      nextUpdate={nextUpdateText}
      modalStyles={modalSurfaceStyles}
    />
  );

  const albumDetailContent = (
    <Stack gap="sm">
      <Text size="sm" c="dimmed">
        All photos in this album. Current and next images are highlighted.
      </Text>
      {displayAlbum && albumPhotos.length > 0 ? (
        <SimpleGrid cols={{ base: 2, sm: 3 }} spacing="sm">
          {albumPhotos.map((photo) => {
            const idStr = String(photo.id);
            const isCurrent = liveCurrentPhotoId && String(liveCurrentPhotoId) === idStr;
            const isNext = liveNextPhotoId && String(liveNextPhotoId) === idStr;
            return (
              <Box
                key={idStr}
                style={{
                  position: "relative",
                  borderRadius: 10,
                  overflow: "hidden",
                  width: "100%",
                  paddingBottom: "100%",
                  background: "var(--mantine-color-gray-1)",
                }}
              >
                <Image
                  src={getUrlFromPhoto(photo)}
                  alt=""
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                  }}
                />
                {(isCurrent || isNext) && (
                  <Badge
                    color={isCurrent ? "green" : "blue"}
                    variant="filled"
                    style={{ position: "absolute", top: 8, left: 8 }}
                  >
                    {isCurrent ? "Current" : "Next"}
                  </Badge>
                )}
              </Box>
            );
          })}
        </SimpleGrid>
      ) : (
        <Text size="sm" c="dimmed">
          No photos in this album yet.
        </Text>
      )}
    </Stack>
  );

  const albumDetailModal = isMobile ? (
    <Drawer
      opened={albumDetailOpen}
      onClose={() => setAlbumDetailOpen(false)}
      position="bottom"
      size="100%"
      padding="md"
      styles={drawerSurfaceStyles}
      scrollAreaComponent={ScrollArea.Autosize}
      title={displayAlbum?.name || "Album details"}
    >
      {albumDetailContent}
    </Drawer>
  ) : (
    <BackgroundModal
      opened={albumDetailOpen}
      onClose={() => setAlbumDetailOpen(false)}
      title={displayAlbum?.name || "Album details"}
      radius="lg"
      size="lg"
      innerPadding="md"
    >
      {albumDetailContent}
    </BackgroundModal>
  );

  if (isMobile) {
    return (
      <>
        <Drawer
        opened={opened}
        onClose={requestClose}
        position="bottom"
        size="100%"
        padding={mobilePadding}
        styles={drawerSurfaceStyles}
        scrollAreaComponent={ScrollArea.Autosize}
        title="Frame details"
      >
        {content}
      </Drawer>
        {albumModal}
        {albumDetailModal}
        <Modal
          opened={confirmUnlinkOpen}
          onClose={() => setConfirmUnlinkOpen(false)}
          title="Unlink frame?"
          radius="lg"
          styles={modalSurfaceStyles}
        >
          <Stack gap="sm">
            <Text>
              This will remove the frame from your account. You’ll need to pair it again to regain access.
            </Text>
            <Group justify="flex-end">
              <Button variant="default" onClick={() => setConfirmUnlinkOpen(false)}>
                Cancel
              </Button>
              <Button color="red" loading={unlinking} onClick={handleUnlink}>
                Unlink
              </Button>
            </Group>
          </Stack>
        </Modal>
        <Modal
          opened={confirmCloseOpen}
          onClose={() => setConfirmCloseOpen(false)}
          title="Discard changes?"
          radius="lg"
          styles={modalSurfaceStyles}
        >
          <Stack gap="sm">
            <Text>
              You have unsaved changes. Are you sure you want to close without saving?
            </Text>
            <Group justify="flex-end">
              <Button variant="default" onClick={() => setConfirmCloseOpen(false)}>
                Continue editing
              </Button>
              <Button color="red" onClick={handleConfirmDiscard}>
                Discard changes
              </Button>
            </Group>
          </Stack>
        </Modal>
      </>
    );
  }

  return (
    <>
      <BackgroundModal opened={opened} onClose={requestClose} size="xl" radius="lg" withCloseButton={false} innerPadding={mobilePadding}>
        <ScrollArea h="75vh">{content}</ScrollArea>
      </BackgroundModal>
      {albumDetailModal}
      <Modal
        opened={confirmUnlinkOpen}
        onClose={() => setConfirmUnlinkOpen(false)}
        title="Unlink frame?"
        radius="lg"
        styles={modalSurfaceStyles}
      >
        <Stack gap="sm">
          <Text>
            This will remove the frame from your account. You’ll need to pair it again to regain access.
          </Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setConfirmUnlinkOpen(false)}>
              Cancel
            </Button>
            <Button color="red" loading={unlinking} onClick={handleUnlink}>
              Unlink
            </Button>
          </Group>
        </Stack>
      </Modal>
      <Modal
        opened={confirmCloseOpen}
        onClose={() => setConfirmCloseOpen(false)}
        title="Discard changes?"
        radius="lg"
        styles={modalSurfaceStyles}
      >
        <Stack gap="sm">
          <Text>
            You have unsaved changes. Are you sure you want to close without saving?
          </Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setConfirmCloseOpen(false)}>
              Continue editing
            </Button>
            <Button color="red" onClick={handleConfirmDiscard}>
              Discard changes
            </Button>
          </Group>
        </Stack>
      </Modal>
      {albumModal}
    </>
  );
}

function AlbumPickerModal({
  opened,
  onClose,
  albums,
  onSelect,
  search,
  onSearch,
  nextUpdate,
  modalStyles,
}: {
  opened: boolean;
  onClose: () => void;
  albums: ReturnType<typeof usePhoto>["albums"];
  onSelect: (albumId: string) => void;
  search: string;
  onSearch: (value: string) => void;
  nextUpdate?: string;
  modalStyles?: any;
}) {
  return (
    <Modal opened={opened} onClose={onClose} title="Choose album" size="lg" radius="lg" styles={modalStyles}>
      <Stack gap="sm">
        <TextInput
          placeholder="Search albums..."
          value={search}
          onChange={(event) => onSearch(event.currentTarget.value)}
          autoFocus
        />
        {albums.length > 0 ? (
          <ScrollArea h={360}>
            <SimpleGrid cols={3} spacing="sm" breakpoints={[{ maxWidth: "md", cols: 2 }, { maxWidth: "sm", cols: 1 }]}>
              {albums.map((album) => {
                const preview = album.photos[0] ? getUrlFromPhoto(album.photos[0]) : undefined;
                const nextPhoto = album.photos[1] || album.photos[0];
                return (
                  <Box
                    key={album.id}
                    component="button"
                    type="button"
                    onClick={() => onSelect(album.id)}
                    style={{
                      textAlign: "left",
                      padding: 6,
                      cursor: "pointer",
                      background: "transparent",
                      border: "none",
                      borderRadius: 12,
                    }}
                  >
                    <Box
                      style={{
                        position: "relative",
                        borderRadius: 12,
                        overflow: "hidden",
                        aspectRatio: "1 / 1",
                        backgroundImage: preview
                          ? `url(${preview})`
                          : "linear-gradient(135deg, #0f172a 0%, #1e293b 35%, #334155 100%)",
                        backgroundSize: "cover",
                        backgroundPosition: "center",
                      }}
                    >
                      <Box
                        style={{
                          position: "absolute",
                          inset: 0,
                          background:
                            "linear-gradient(180deg, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.7) 100%)",
                        }}
                      />
                      <Badge
                        size="xs"
                        variant="light"
                        color="dark"
                        radius="sm"
                        style={{ position: "absolute", bottom: 8, left: 8, textTransform: "none" }}
                      >
                        {album.photos.length} photo{album.photos.length === 1 ? "" : "s"}
                      </Badge>
                      <Stack
                        gap={2}
                        style={{
                          position: "absolute",
                          left: 10,
                          right: 10,
                          bottom: 10,
                          color: "var(--mantine-color-gray-1)",
                        }}
                      >
                        <Text fw={600} size="sm" lineClamp={1} c="gray.0">
                          {album.name || "Untitled album"}
                        </Text>
                      </Stack>
                    </Box>
                  </Box>
                );
              })}
            </SimpleGrid>
          </ScrollArea>
        ) : (
          <Paper withBorder radius="md" p="sm">
            <Text size="sm" c="dimmed">
              No albums available.
            </Text>
          </Paper>
        )}
      </Stack>
    </Modal>
  );
}

const deriveScheduleLabel = (frame: Frame): Frame["refreshSchedule"] => {
  if (frame.scheduleMode === "times") return "daily-morning";
  const mins = frame.intervalMinutes || 60;
  if (mins <= 60) return "hourly";
  if (mins <= 240) return "four-hours";
  return "daily-midnight";
};

const parseTimestamp = (value: string | number | null | undefined) => {
  if (!value) return null;
  const ts = typeof value === "number" ? value : Date.parse(value);
  return Number.isFinite(ts) ? ts : null;
};

const computeNextTriggerTime = ({
  liveNextUpdate,
  scheduleMode,
  intervalMinutes,
  timesOfDay,
}: {
  liveNextUpdate?: string | number | null;
  scheduleMode?: "interval" | "times" | null;
  intervalMinutes?: number | null;
  timesOfDay?: string[];
}) => {
  const liveTs = parseTimestamp(liveNextUpdate);
  if (liveTs) return liveTs;

  if (scheduleMode === "times" && Array.isArray(timesOfDay) && timesOfDay.length > 0) {
    const normalized = sortAndNormalizeTimes(timesOfDay);
    if (normalized.length > 0) {
      const now = new Date();
      const candidates = normalized
        .map((t) => {
          const [h, m] = String(t || "").split(":").map((v) => parseInt(v, 10));
          const dt = new Date(now);
          dt.setHours(isNaN(h) ? 0 : h, isNaN(m) ? 0 : m, 0, 0);
          if (dt <= now) {
            dt.setDate(dt.getDate() + 1);
          }
          return dt.getTime();
        })
        .filter(Boolean)
        .sort((a, b) => a - b);
      return candidates[0] || null;
    }
  }

  const minutes = Math.max(1, intervalMinutes || 60);
  return Date.now() + minutes * 60 * 1000;
};

const formatNextTriggerLabel = (params: {
  liveNextUpdate?: string | number | null;
  scheduleMode?: "interval" | "times" | null;
  intervalMinutes?: number | null;
  timesOfDay?: string[];
}) => {
  const ts = computeNextTriggerTime(params);
  if (!ts) return "Unknown";
  const dt = new Date(ts);
  return dt.toLocaleString();
};

type InsightCardProps = {
  label: string;
  value: string;
  hint?: string;
  icon?: ReactNode;
  isDark: boolean;
};

function InsightCard({ label, value, hint, icon, isDark }: InsightCardProps) {
  return (
    <Paper
      withBorder
      radius="md"
      p="md"
      style={{
        borderColor: isDark ? "var(--mantine-color-dark-4)" : "var(--mantine-color-gray-3)",
        background: isDark
          ? "linear-gradient(135deg, rgba(17,24,39,0.55) 0%, rgba(30,41,59,0.7) 100%)"
          : "linear-gradient(135deg, rgba(15,23,42,0.04) 0%, rgba(15,23,42,0.08) 100%)",
      }}
    >
      <Group align="flex-start" gap="sm" wrap="nowrap">
        {icon && (
          <Box
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              backgroundColor: isDark ? "rgba(52,125,244,0.16)" : "var(--mantine-color-blue-1)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: isDark ? "var(--mantine-color-blue-2)" : "var(--mantine-color-blue-7)",
              flexShrink: 0,
            }}
          >
            {icon}
          </Box>
        )}
        <Stack gap={4} style={{ minWidth: 0 }}>
          <Text size="xs" c="dimmed" tt="uppercase" fw={600} style={{ letterSpacing: 0.6 }}>
            {label}
          </Text>
          <Text fw={700} size="sm" style={{ wordBreak: "break-word" }}>
            {value || "—"}
          </Text>
          {hint && (
            <Text size="xs" c="dimmed" lineClamp={2}>
              {hint}
            </Text>
          )}
        </Stack>
      </Group>
    </Paper>
  );
}
