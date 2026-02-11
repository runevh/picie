import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Badge,
  ActionIcon,
  Button,
  Group,
  LoadingOverlay,
  Modal,
  Paper,
  ScrollArea,
  Stack,
  Table,
  Text,
  Textarea,
  Title,
  Tooltip,
  CopyButton,
  Select,
  FileButton,
  Alert,
} from "@mantine/core";
import {
  IconDeviceFloppy,
  IconExclamationCircle,
  IconFileText,
  IconPower,
  IconRefresh,
  IconTrash,
  IconPlus,
  IconCopy,
  IconUpload,
  IconCloudUpload,
} from "@tabler/icons-react";
import { useDeviceContext } from "../../contexts/DeviceContext";
import { notifications } from "@mantine/notifications";

type FrameRecord = {
  id: string;
  status?: string;
  isOnline?: boolean;
  lastSeen?: string | Date | null;
  softwareVersion?: string;
  name?: string | null;
  owner?: {
    name?: string | null;
    email?: string | null;
  } | null;
};

const normalizeFrames = (payload: unknown): FrameRecord[] => {
  const data =
    (payload as { devices?: unknown; data?: unknown })?.data ??
    (payload as { devices?: unknown })?.devices ??
    payload;

  if (Array.isArray(data)) return data as FrameRecord[];
  return [];
};

export function AdminPage() {
  const {
    createDevice,
    getAllDevices,
    deleteDevice,
    rebootDevice,
    fetchDeviceLogs,
    uploadFirmware,
  } = useDeviceContext();

  const [frames, setFrames] = useState<FrameRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [rebootingId, setRebootingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteModalFrame, setDeleteModalFrame] = useState<FrameRecord | null>(null);
  const [logsModalOpen, setLogsModalOpen] = useState(false);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsContent, setLogsContent] = useState("");
  const [logsFrame, setLogsFrame] = useState<FrameRecord | null>(null);
  const [credentialsModalOpen, setCredentialsModalOpen] = useState(false);
  const [credentialsContent, setCredentialsContent] = useState<{ uuid?: string; secret?: string; publicId?: string } | null>(null);
  const [otaModalOpen, setOtaModalOpen] = useState(false);
  const [otaTargetId, setOtaTargetId] = useState<string | null>(null);
  const [otaFile, setOtaFile] = useState<File | null>(null);
  const [otaLoading, setOtaLoading] = useState(false);

  const notifyFailure = (title: string, message?: string) => {
    notifications.show({
      title,
      message: message ?? "Something went wrong. Please try again.",
      color: "red",
    });
  };

  const isSuccess = (response: { success: boolean; data?: any }) => {
    if (!response) return false;
    if (!response.success) return false;
    if (typeof response.data === "object" && response.data !== null && "success" in response.data) {
      return Boolean((response.data as { success?: boolean }).success);
    }
    return true;
  };

  const loadFrames = useCallback(
    async (opts?: { silent?: boolean }) => {
      const silent = opts?.silent ?? false;
      if (!silent) setLoading(true);
      else setRefreshing(true);
    try {
      const response = await getAllDevices();
      const payload = (response.data as { data?: unknown })?.data ?? response.data;
      const parsed = normalizeFrames(payload);
      setFrames(parsed);
    } catch (error) {
      console.warn("Failed to load frames", error);
      setFrames([]);
    } finally {
        if (!silent) setLoading(false);
        setRefreshing(false);
    }
    },
    [getAllDevices]
  );

  useEffect(() => {
    loadFrames();
  }, [loadFrames]);

  useEffect(() => {
    const interval = setInterval(() => {
      loadFrames({ silent: true });
    }, 5000);
    return () => clearInterval(interval);
  }, [loadFrames]);

  const handleCreateFrame = async () => {
    setCreating(true);
    try {
      const response = await createDevice();
      if (isSuccess(response)) {
        const payload = (response.data as { data?: any })?.data ?? response.data;
        setCredentialsContent({
          uuid: payload?.uuid,
          secret: payload?.secret,
          publicId: payload?.publicId,
        });
        setCredentialsModalOpen(true);
        await loadFrames();
      } else {
        notifyFailure("Failed to create frame", String(response?.data ?? ""));
      }
    } finally {
      setCreating(false);
    }
  };

  const handleRebootFrame = async (frame: FrameRecord) => {
    setRebootingId(frame.id);
    try {
      const response = await rebootDevice(frame.id);
      if (!isSuccess(response)) {
        notifyFailure("Failed to reboot frame", String(response?.data ?? ""));
      }
    } finally {
      setRebootingId(null);
    }
  };

  const confirmDeleteFrame = async () => {
    if (!deleteModalFrame) return;
    setDeletingId(deleteModalFrame.id);
    try {
      const response = await deleteDevice(deleteModalFrame.id);
      if (isSuccess(response)) {
        setFrames((prev) => prev.filter((frame) => frame.id !== deleteModalFrame.id));
      } else {
        notifyFailure("Failed to delete frame", String(response?.data ?? ""));
      }
    } finally {
      setDeletingId(null);
      setDeleteModalFrame(null);
    }
  };

  const handleViewLogs = async (frame: FrameRecord) => {
    setLogsFrame(frame);
    setLogsContent("");
    setLogsModalOpen(true);
    setLogsLoading(true);
    try {
      const response = await fetchDeviceLogs(frame.id);
      if (isSuccess(response)) {
        const logs =
          (response.data as { logs?: string })?.logs ??
          (response.data as { data?: { logs?: string } })?.data?.logs ??
          JSON.stringify(response.data, null, 2);
        setLogsContent(logs);
      } else {
        setLogsContent("Unable to load logs for this frame.");
        notifyFailure("Failed to load logs", String(response?.data ?? ""));
      }
    } finally {
      setLogsLoading(false);
    }
  };

  const fileToBase64 = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(",")[1] || "";
        resolve(base64);
      };
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });

  const handleOpenOta = (frameId?: string) => {
    const targetId = frameId ?? frames[0]?.id ?? null;
    setOtaTargetId(targetId || null);
    setOtaFile(null);
    setOtaModalOpen(true);
  };

  const handleSubmitOta = async () => {
    if (!otaTargetId || !otaFile) {
      notifyFailure("Missing info", "Select a frame and a firmware file first.");
      return;
    }

    if (otaFile.size > 2_000_000) {
      notifyFailure("File too large", "Firmware must be smaller than ~2MB for the ESP8266 flash size.");
      return;
    }

    setOtaLoading(true);
    try {
      const data = await fileToBase64(otaFile);
      const response = await uploadFirmware({ id: otaTargetId, filename: otaFile.name, data });
      if (isSuccess(response)) {
        notifications.show({
          title: "OTA started",
          message: `Pushing ${otaFile.name} (${Math.round(otaFile.size / 1024)} KB)`,
          color: "teal",
        });
        setOtaModalOpen(false);
      } else {
        notifyFailure("OTA failed", String(response?.data ?? ""));
      }
    } catch (err: any) {
      notifyFailure("OTA failed", err?.message);
    } finally {
      setOtaLoading(false);
    }
  };

  const formatId = (id: string) => id?.toString().padStart(6, "0").slice(-6);

  const derivedFrames = useMemo(() => {
    return frames.map((frame) => {
      const lastSeenDate =
        typeof frame.lastSeen === "string" || frame.lastSeen instanceof Date
          ? new Date(frame.lastSeen)
          : null;
      const onlineFromStatus =
        typeof frame.isOnline === "boolean"
          ? frame.isOnline
          : frame.status?.toLowerCase() === "online";
      const fallbackOnline =
        lastSeenDate !== null
          ? Date.now() - lastSeenDate.getTime() < 5 * 60 * 1000
          : false;

      return {
        ...frame,
        lastSeenDate,
        isOnline: onlineFromStatus ?? fallbackOnline,
      };
    });
  }, [frames]);

  const frameOptions = useMemo(
    () =>
      derivedFrames.map((frame) => ({
        value: frame.id,
        label: `${formatId(frame.id)}${frame.name ? ` — ${frame.name}` : ""}`,
      })),
    [derivedFrames]
  );

  const renderStatusBadge = (frame: typeof derivedFrames[number]) => {
    const color = frame.isOnline ? "green" : "gray";
    const label = frame.isOnline ? "Online" : "Offline";
    return (
      <Badge color={color} variant="light">
        {label}
      </Badge>
    );
  };

  const renderClaimBadge = (frame: typeof derivedFrames[number]) => {
    const claimed = Boolean(frame.owner);
    const color = claimed ? "blue" : "gray";
    return (
      <Stack gap={2}>
        <Badge color={color} variant="light">
          {claimed ? "Claimed" : "Unclaimed"}
        </Badge>
        {claimed && (
          <Text size="xs" c="dimmed" style={{ whiteSpace: "nowrap" }}>
            {frame.owner?.name ?? frame.owner?.email}
          </Text>
        )}
      </Stack>
    );
  };

  const renderLastSeen = (frame: typeof derivedFrames[number]) => {
    if (!frame.lastSeenDate) return "Never";
    return frame.lastSeenDate.toLocaleString();
  };

  return (
    <Stack gap="lg" p="md">
      <Group justify="space-between" align="flex-start">
        <div>
          <Title order={2}>Frame Administration</Title>
          <Text c="dimmed" size="sm">
            Monitor frame health, provision new hardware, and perform remote actions.
          </Text>
        </div>
        <Group>
          <Button
            variant="light"
            leftSection={<IconRefresh size={16} />}
            onClick={loadFrames}
            disabled={loading || refreshing}
          >
            Refresh
          </Button>
          <Button
            variant="outline"
            leftSection={<IconCloudUpload size={16} />}
            onClick={() => handleOpenOta()}
            disabled={frames.length === 0}
          >
            OTA update
          </Button>
          <Button
            leftSection={<IconPlus size={16} />}
            loading={creating}
            onClick={handleCreateFrame}
          >
            New frame
          </Button>
        </Group>
      </Group>

      <Paper withBorder radius="lg" p="md" pos="relative">
        <LoadingOverlay visible={loading} />
        <ScrollArea>
          <Table highlightOnHover horizontalSpacing="md" verticalSpacing="sm">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>ID</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Last seen</Table.Th>
                <Table.Th>Owner</Table.Th>
                <Table.Th>Software</Table.Th>
                <Table.Th>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {derivedFrames.length === 0 ? (
                <Table.Tr>
                  <Table.Td colSpan={5}>
                    <Group gap="xs">
                      <IconExclamationCircle size={16} />
                      <Text size="sm" c="dimmed">
                        No frames found. Create one to get started.
                      </Text>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ) : (
                derivedFrames.map((frame) => (
                  <Table.Tr key={frame.id}>
                    <Table.Td>
                      <Text fw={600}>{formatId(frame.id)}</Text>
                      <Text size="xs" c="dimmed">
                        {frame.id}
                      </Text>
                    </Table.Td>
                    <Table.Td>{renderStatusBadge(frame)}</Table.Td>
                    <Table.Td>{renderLastSeen(frame)}</Table.Td>
                    <Table.Td>{renderClaimBadge(frame)}</Table.Td>
                    <Table.Td>
                      <Group gap={4}>
                        <IconDeviceFloppy size={16} />
                        <Text size="sm">
                          {frame.softwareVersion ?? "Unknown"}
                        </Text>
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <Group gap="xs">
                        <Tooltip label="Send firmware OTA">
                          <Button
                            variant="outline"
                            size="xs"
                            leftSection={<IconUpload size={14} />}
                            onClick={() => handleOpenOta(frame.id)}
                          >
                            OTA
                          </Button>
                        </Tooltip>
                        <Tooltip label="Reboot frame">
                          <Button
                            variant="light"
                            size="xs"
                            leftSection={<IconPower size={14} />}
                            loading={rebootingId === frame.id}
                            onClick={() => handleRebootFrame(frame)}
                          >
                            Reboot
                          </Button>
                        </Tooltip>
                        <Tooltip label="View logs">
                          <Button
                            variant="default"
                            size="xs"
                            leftSection={<IconFileText size={14} />}
                            onClick={() => handleViewLogs(frame)}
                          >
                            Logs
                          </Button>
                        </Tooltip>
                        <Tooltip label="Delete frame">
                          <Button
                            color="red"
                            variant="light"
                            size="xs"
                            leftSection={<IconTrash size={14} />}
                            onClick={() => setDeleteModalFrame(frame)}
                            loading={deletingId === frame.id}
                          >
                            Delete
                          </Button>
                        </Tooltip>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))
              )}
            </Table.Tbody>
          </Table>
        </ScrollArea>
      </Paper>

      <Modal
        opened={otaModalOpen}
        onClose={() => setOtaModalOpen(false)}
        title="Firmware over-the-air"
        centered
        size="md"
      >
        <Stack gap="md">
          <Alert color="blue" title="Heads up">
            Device must be online and firmware should be under ~2 MB (ESP8266 flash limit). The frame will reboot after the update.
          </Alert>
          <Select
            label="Target frame"
            placeholder="Select frame"
            data={frameOptions}
            value={otaTargetId}
            onChange={(value) => setOtaTargetId(value)}
            searchable
          />
          <Group>
            <FileButton onChange={setOtaFile} accept=".bin" disabled={!otaTargetId}>
              {(props) => (
                <Button {...props} variant="light" leftSection={<IconUpload size={16} />}>
                  Choose .bin file
                </Button>
              )}
            </FileButton>
            {otaFile && (
              <Text size="sm" c="dimmed">
                {otaFile.name} • {Math.round(otaFile.size / 1024)} KB
              </Text>
            )}
          </Group>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setOtaModalOpen(false)}>
              Cancel
            </Button>
            <Button
              color="teal"
              leftSection={<IconCloudUpload size={16} />}
              loading={otaLoading}
              onClick={handleSubmitOta}
              disabled={!otaTargetId || !otaFile}
            >
              Upload firmware
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={logsModalOpen}
        onClose={() => {
          setLogsModalOpen(false);
          setLogsFrame(null);
        }}
        title={logsFrame ? `Logs for ${formatId(logsFrame.id)}` : "Frame logs"}
        size="lg"
        centered
      >
        <Stack gap="sm">
          <Textarea
            value={logsContent}
            readOnly
            minRows={12}
            autosize
            styles={{ input: { fontFamily: "monospace" } }}
          />
          {logsLoading && <Text size="sm">Loading logs…</Text>}
        </Stack>
      </Modal>

      <Modal
        opened={credentialsModalOpen}
        onClose={() => setCredentialsModalOpen(false)}
        title="Frame credentials"
        centered
        size="md"
      >
        <Stack gap="sm">
          {credentialsContent ? (
            <Stack gap={8} styles={{ root: { fontFamily: "monospace" } }}>
              {[
                { label: "Public ID", value: credentialsContent.publicId },
                { label: "UUID", value: credentialsContent.uuid },
                { label: "Secret", value: credentialsContent.secret },
              ].map((item) => (
                <Group key={item.label} justify="space-between" gap="xs" wrap="nowrap">
                  <Text
                    size="sm"
                    style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
                  >
                    {item.label}: {item.value}
                  </Text>
                  <CopyButton value={item.value || ""} timeout={1500}>
                    {({ copied, copy }) => (
                      <Tooltip label={copied ? "Copied" : `Copy ${item.label.toLowerCase()}`}>
                        <ActionIcon variant={copied ? "filled" : "light"} color={copied ? "teal" : "gray"} onClick={copy} aria-label={`Copy ${item.label}`}>
                          <IconCopy size={16} />
                        </ActionIcon>
                      </Tooltip>
                    )}
                  </CopyButton>
                </Group>
              ))}
              <Text size="xs" c="dimmed">
                Shown only once after creation. Copy now and share only with authorized technicians.
              </Text>
            </Stack>
          ) : (
            <Text size="sm">No credentials available for this frame.</Text>
          )}
        </Stack>
      </Modal>

      <Modal
        opened={Boolean(deleteModalFrame)}
        onClose={() => setDeleteModalFrame(null)}
        title="Delete frame?"
        centered
        withCloseButton
      >
        <Stack gap="md">
          <Text size="sm">
            This will permanently remove frame{" "}
            <Text component="span" fw={600}>
              {deleteModalFrame ? formatId(deleteModalFrame.id) : ""}
            </Text>{" "}
            from the fleet. The device will need to be re-provisioned to come back
            online.
          </Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setDeleteModalFrame(null)}>
              Cancel
            </Button>
            <Button
              color="red"
              loading={deletingId === deleteModalFrame?.id}
              onClick={confirmDeleteFrame}
            >
              Delete frame
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
