import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Badge,
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
} from "@mantine/core";
import {
  IconDeviceFloppy,
  IconExclamationCircle,
  IconFileText,
  IconPower,
  IconRefresh,
  IconTrash,
  IconPlus,
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

  const formatId = (id: string) => id?.toString().padStart(6, "0").slice(-6);

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
