import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Badge,
  Box,
  Button,
  Center,
  Checkbox,
  Flex,
  Group,
  Popover,
  Select,
  Stack,
  Text,
  TextInput,
  Title,
  ThemeIcon,
  useComputedColorScheme,
} from "@mantine/core";
import { FrameCover } from "./FramCover";
import { IconFilter, IconPlus, IconRadar, IconDeviceDesktop } from "@tabler/icons-react";
import { useIsMobile } from "../../util/LayoutUtil";
import { useDisclosure } from "@mantine/hooks";
import { useFrameAdder } from "./FrameAdder";
import { Frame } from "./Frame.types";
import { FrameDetailModal } from "./FrameDetailModal";
import { useDeviceContext } from "../../contexts/DeviceContext";
import { notifications } from "@mantine/notifications";
import { getApiBase } from "../../util/UrlUtil";
import { Background } from "../layout/Background";
import { GlassCard } from "../layout/GlassCard";
import { PageHero } from "../layout/PageHero";
import { PulseCard } from "../layout/PulseCard";

export function FramesPage() {

  const isMobile = useIsMobile();
  const computedColorScheme = useComputedColorScheme("light", { getInitialValueInEffect: true });
  const isDark = computedColorScheme === "dark";
  const surface = isDark ? "rgba(20, 24, 35, 0.9)" : "rgba(255,255,255,0.92)";
  const surfaceBorder = isDark ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.4)";
  const heroOverlay = isDark
    ? "linear-gradient(145deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))"
    : "linear-gradient(145deg, rgba(255,255,255,0.25), rgba(255,255,255,0.12))";
  const [opened, { toggle, close }] = useDisclosure(false);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("lastModified");
  const [sharedOnly, setSharedOnly] = useState(false);
  const [frames, setFrames] = useState<Frame[]>([]);
  const [activeFrame, setActiveFrame] = useState<Frame | null>(null);
  const [lockActiveFrame, setLockActiveFrame] = useState(false);
  const { getAllUserDevices, unlinkDevice, updateDevice } = useDeviceContext();

  const { openFrameAdder } = useFrameAdder();

  const fetchFrames = useCallback(async () => {
    try {
      const response = await getAllUserDevices();
      const data =
        (response.data as { data?: unknown })?.data ??
        (response.data as { devices?: unknown })?.devices ??
        response.data;

      if (Array.isArray(data)) {
        const normalized: Frame[] = data.map((device) => {
          const id = (device as any).id || (device as any).publicId || (device as any).uuid || "unknown";
          const name = (device as any).name || `Frame ${id}`;
          const lastSeen = (device as any).lastSeen ?? null;
          const isOnline =
            typeof (device as any).isOnline === "boolean"
              ? (device as any).isOnline
              : lastSeen
                ? Date.now() - new Date(lastSeen).getTime() < 5 * 60 * 1000
                : false;

          const statusFromServer = (device as any).status;
          let status: Frame["status"] = isOnline ? "online" : "offline";
          if (statusFromServer === "updating_image") status = "updating";
          else if (statusFromServer === "updating_frame") status = "updating_frame";
          else if (statusFromServer === "pairing") status = "pairing";
          else if (statusFromServer === "error") status = "error";

          const activeImage =
            (device as any).activeImage ||
            ((device as any).currentPhotoId
              ? `${getApiBase()}photo/get/${(device as any).currentPhotoId}.png`
              : undefined);
          const albumIdRaw = (device as any).albumId ?? (device as any).album?.id;
          const currentAlbum = albumIdRaw === undefined || albumIdRaw === null ? null : String(albumIdRaw);
          const albumObj = (device as any).album
            ? {
                id: String((device as any).album.id),
                name: (device as any).album.name ?? null,
              }
            : currentAlbum
              ? { id: currentAlbum, name: null }
              : null;

          return {
            id: String(id),
            name,
            description: (device as any).description || "",
            activeImage,
            currentPhotoId: (device as any).currentPhotoId ?? null,
            nextPhotoId: (device as any).nextPhotoId ?? null,
            status,
            currentAlbum,
            album: albumObj,
            scheduleMode: (device as any).scheduleMode ?? null,
            intervalMinutes: (device as any).intervalMinutes ?? null,
            timesOfDay: Array.isArray((device as any).timesOfDay) ? (device as any).timesOfDay : [],
            timeZone: (device as any).timeZone || "UTC",
            refreshSchedule: "hourly",
            lastSeen,
            nextUpdate: (device as any).nextUpdate,
          };
        });
        setFrames(normalized);
      } else {
        setFrames([]);
      }
    } catch (err) {
      console.warn("Failed to load frames", err);
      setFrames([]);
    }
  }, [getAllUserDevices]);

  useEffect(() => {
    fetchFrames();
  }, [fetchFrames]);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchFrames();
    }, 5000);
    return () => clearInterval(interval);
  }, [fetchFrames]);

  useEffect(() => {
    const handler = () => fetchFrames();
    window.addEventListener("frame-paired", handler);
    return () => window.removeEventListener("frame-paired", handler);
  }, [fetchFrames]);

  useEffect(() => {
    if (!activeFrame || lockActiveFrame) return;
    const latest = frames.find((f) => f.id === activeFrame.id);
    if (latest && latest !== activeFrame) {
      setActiveFrame(latest);
    }
  }, [frames, activeFrame, lockActiveFrame]);

  const filteredFrames = useMemo(() => {
    let list = [...frames];
    if (sharedOnly) {
      list = list.filter((frame) => (frame.sharedWith?.length ?? 0) > 0);
    }
    if (search.trim()) {
      const term = search.toLowerCase();
      list = list.filter(
        (frame) => frame.name.toLowerCase().includes(term) || frame.description?.toLowerCase().includes(term)
      );
    }
    if (sortBy === "name") {
      list.sort((a, b) => a.name.localeCompare(b.name));
    }
    return list;
  }, [frames, search, sharedOnly, sortBy]);

  const onlineCount = useMemo(() => frames.filter((frame) => frame.status === "online").length, [frames]);
  const sharedCount = useMemo(() => frames.filter((frame) => (frame.sharedWith?.length ?? 0) > 0).length, [frames]);

  const openDetail = (frame: Frame) => {
    setActiveFrame(frame);
    setLockActiveFrame(true);
  };

  const closeDetail = () => {
    setActiveFrame(null);
    setLockActiveFrame(false);
  };

  const handleSave = async (
    updatedFrame: Frame,
    opts: {
      schedule: { mode: "interval" | "times"; intervalMinutes: number; timesOfDay: string[]; timeZone: string };
      closeAfterSave?: boolean;
    }
  ) => {
    const shouldClose = opts?.closeAfterSave !== false;
    try {
      const timesPayload = Array.isArray(opts.schedule.timesOfDay)
        ? opts.schedule.timesOfDay
        : Array.isArray(updatedFrame.timesOfDay)
          ? updatedFrame.timesOfDay
          : [];
      const res = await updateDevice({
        id: updatedFrame.id,
        name: updatedFrame.name,
        schedule: {
          mode: opts.schedule.mode,
          intervalMinutes: opts.schedule.intervalMinutes,
          timesOfDay: timesPayload,
          timeZone: opts.schedule.timeZone,
        },
        albumId: updatedFrame.currentAlbum,
      });
      if (res.success) {
        const data = (res.data || {}) as any;
        const albumId = data.albumId === undefined || data.albumId === null ? null : String(data.albumId);
        const albumObj = data.album
          ? { id: String(data.album.id), name: data.album.name ?? null }
          : albumId
            ? { id: albumId, name: null }
            : updatedFrame.album ?? null;
        const frameWithUpdate: Frame = {
          ...updatedFrame,
          nextUpdate: data.nextUpdate ?? updatedFrame.nextUpdate,
          currentAlbum: albumId ?? updatedFrame.currentAlbum,
          album: albumObj,
          currentPhotoId: data.currentPhotoId ?? updatedFrame.currentPhotoId,
          nextPhotoId: data.nextPhotoId ?? updatedFrame.nextPhotoId,
          scheduleMode: data.scheduleMode ?? updatedFrame.scheduleMode,
          intervalMinutes: data.intervalMinutes ?? updatedFrame.intervalMinutes,
          timesOfDay: Array.isArray(data.timesOfDay) ? data.timesOfDay : updatedFrame.timesOfDay,
          timeZone: data.timeZone ?? updatedFrame.timeZone,
        };
        setFrames((prev) => prev.map((frame) => (frame.id === updatedFrame.id ? frameWithUpdate : frame)));
        if (!shouldClose) {
          setActiveFrame(frameWithUpdate);
        } else {
          setActiveFrame(null);
          setLockActiveFrame(false);
        }
        await fetchFrames();
        notifications.show({
          title: "Saved",
          message: shouldClose ? "Frame settings updated." : "Album updated on frame.",
          color: "green",
        });
      } else {
        const message = typeof res.data === "string" ? res.data : (res.data as any)?.message || "Unable to save";
        notifications.show({ title: "Save failed", message, color: "red" });
      }
    } catch (err) {
      notifications.show({ title: "Save failed", message: "Something went wrong while saving.", color: "red" });
    }
  };

  const handleUnlink = async (frame: Frame) => {
    try {
      const res = await unlinkDevice(frame.id);
      if (res.success) {
        setFrames((prev) => prev.filter((f) => f.id !== frame.id));
        setActiveFrame(null);
        setLockActiveFrame(false);
        notifications.show({ title: "Frame unlinked", message: "The frame was removed from your account.", color: "green" });
      } else {
        const message = typeof res.data === "string" ? res.data : (res.data as any)?.message || "Unable to unlink frame";
        notifications.show({ title: "Unlink failed", message, color: "red" });
      }
    } catch (err) {
      notifications.show({ title: "Unlink failed", message: "Something went wrong while unlinking.", color: "red" });
    }
  };

  return (
    <Background
      px={{ base: "md", md: "xl" }}
      pb={{ base: "md", md: "xl" }}
      style={{
        minHeight: "100%",
        // keep content clear of the notch/status bar while matching page padding
        paddingTop: "calc(var(--safe-area-top) + var(--mantine-spacing-md))",
      }}
    >
      <Stack gap="xl">
        <PageHero
          overlay={heroOverlay}
          badge={null}
          title={
            <Title order={1} size="h2">
              My Frames
            </Title>
          }
          description={
            <Text c="dimmed" size="sm">
              Keep track of every connected display, see who it is shared with, and jump into fine-grained controls.
            </Text>
          }
          actions={
            <Group gap="sm" wrap="wrap">
              <Button px={12} variant="filled" title="Add frame" onClick={openFrameAdder} leftSection={<IconPlus size={18} />}>
                New frame
              </Button>
              <Popover width={260} position="bottom-end" withArrow shadow="md" opened={opened}>
                <Popover.Target>
                  <Button
                    leftSection={<IconFilter size={16} />}
                    variant="default"
                    onClick={toggle}
                  >
                    Filters
                  </Button>
                </Popover.Target>
                <Popover.Dropdown>
                  <Stack>
                    <TextInput
                      label="Search by name"
                      placeholder="Frame name..."
                      value={search}
                      onChange={(e) => setSearch(e.currentTarget.value)}
                    />

                    <Select
                      label="Sort by"
                      data={[
                        { label: "Last modified", value: "lastModified" },
                        { label: "Date created", value: "dateCreated" },
                        { label: "Name (A-Z)", value: "name" },
                      ]}
                      value={sortBy}
                      onChange={(value) => setSortBy(value || "lastModified")}
                    />

                    <Checkbox
                      label="Shared only"
                      checked={sharedOnly}
                      onChange={(e) => setSharedOnly(e.currentTarget.checked)}
                    />

                    <Group justify="space-between" mt="xs">
                      <Button variant="light" size="xs" onClick={() => {
                        setSearch("");
                        setSortBy("lastModified");
                        setSharedOnly(false);
                        close();
                      }}>
                        Clear
                      </Button>
                      <Button size="xs" onClick={close}>
                        Apply
                      </Button>
                    </Group>
                  </Stack>
                </Popover.Dropdown>
              </Popover>
            </Group>
          }
          meta={
            <Group gap="sm" wrap="wrap">
              <Badge variant="light" color="blue">
                {frames.length} {frames.length === 1 ? "frame" : "frames"}
              </Badge>
              <Badge variant="light" color="teal">
                {onlineCount} online
              </Badge>
              <Badge variant="light" color="gray">
                {sharedCount} shared
              </Badge>
            </Group>
          }
          aside={
            <PulseCard
              icon={IconDeviceDesktop}
              iconColor="indigo"
              title="Fleet pulse"
              description="Live stats for your displays at a glance."
              shadow={isDark ? "0 16px 50px -50px rgba(0,0,0,0.7)" : "0 16px 50px -40px rgba(15, 23, 42, 0.5)"}
              blur={8}
              style={{ minWidth: 260, background: surface, borderColor: surfaceBorder }}
              items={[
                { label: "Total frames", value: frames.length },
                { label: "Online now", value: onlineCount },
                { label: "Shared", value: sharedCount },
              ]}
            />
          }
        />

        <GlassCard radius="lg" p="lg" shadow={isDark ? "0 18px 70px -70px rgba(0,0,0,0.65)" : "0 18px 70px -60px rgba(15, 23, 42, 0.35)"}>
          {filteredFrames.length > 0 ? (
            <Box
              style={{
                display: "grid",
                gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fit, minmax(280px, 360px))",
                gap: "1.5rem",
                justifyContent: "flex-start",
                justifyItems: "stretch",
              }}
            >
              {filteredFrames.map((frame) => (
                <FrameCover key={frame.id} frame={frame} onClick={openDetail} />
              ))}
            </Box>
          ) : (
            <Center py="xl">
              <Text c="dimmed">No frames match your filters.</Text>
            </Center>
          )}
        </GlassCard>

        {activeFrame && (
          <FrameDetailModal
            frame={activeFrame}
            liveFrame={frames.find((f) => f.id === activeFrame.id) || null}
            opened={Boolean(activeFrame)}
            onClose={closeDetail}
            onSave={handleSave}
            onUnlink={handleUnlink}
          />
        )}
      </Stack>
    </Background>
  );
}
