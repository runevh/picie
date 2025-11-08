import { useMemo, useState } from "react";
import { Box, Button, Checkbox, Flex, Group, Popover, Select, Stack, TextInput, Title, Text, Center } from "@mantine/core";
import { FrameCover } from "./FramCover";
import { IconFilter, IconPlus } from "@tabler/icons-react";
import { useIsMobile } from "../../util/LayoutUtil";
import { useDisclosure } from "@mantine/hooks";
import { useFrameAdder } from "./FrameAdder";
import { Frame } from "./Frame.types";
import { FrameDetailModal } from "./FrameDetailModal";

const mockFrames: Frame[] = [
  {
    id: "frame-living",
    name: "Living Room Frame",
    description: "Main frame in the living room displaying family photos.",
    activeImage: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=800&q=80",
    status: "online",
    currentAlbum: null,
    sharedWith: ["alice@example.com", "bob@example.com"],
    refreshSchedule: "hourly",
  },
  {
    id: "frame-bedroom",
    name: "Bedroom Frame",
    description:
      "Cozy frame with relaxing nature scenes. Perfect for winding down at night with soft curated playlists of images.",
    activeImage: "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=800&q=80",
    status: "offline",
    currentAlbum: null,
    sharedWith: [],
    refreshSchedule: "daily-midnight",
  },
  {
    id: "frame-office",
    name: "Office Frame",
    description: "Frame in the home office, showing work-related photos and inspiration from recent shoots.",
    activeImage: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=800&q=80",
    status: "offline",
    currentAlbum: null,
    sharedWith: ["carol@example.com"],
    refreshSchedule: "four-hours",
  },
];

export function FramesPage() {

  const isMobile = useIsMobile();
  const [opened, { toggle, close }] = useDisclosure(false);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("lastModified");
  const [sharedOnly, setSharedOnly] = useState(false);
  const [frames, setFrames] = useState<Frame[]>(mockFrames);
  const [activeFrame, setActiveFrame] = useState<Frame | null>(null);

  const { openFrameAdder } = useFrameAdder();

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

  const openDetail = (frame: Frame) => {
    setActiveFrame(frame);
  };

  const closeDetail = () => setActiveFrame(null);

  const handleSave = (updatedFrame: Frame) => {
    setFrames((prev) => prev.map((frame) => (frame.id === updatedFrame.id ? updatedFrame : frame)));
    setActiveFrame(updatedFrame);
  };

  return (
    <Stack gap="lg" p="md">
      <Flex justify="space-between" align="flex-start" wrap="wrap" gap="md">
        <Box>
          <Title order={2}>My Frames</Title>
          <Text c="dimmed" size="sm">
            Keep track of every connected display, see who it is shared with, and jump into fine-grained controls.
          </Text>
        </Box>
        <Group gap="sm" mt={isMobile ? "sm" : 0}>
          <Button px={12} variant="light" title="Add frame" onClick={openFrameAdder} leftSection={<IconPlus size={18} />}>
            New frame
          </Button>
          <Popover width={250} position="bottom-end" withArrow shadow="md" opened={opened}>
            <Popover.Target>
              <Button
                leftSection={<IconFilter size={16} />}
                variant="outline"
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
      </Flex>
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
      {activeFrame && (
        <FrameDetailModal frame={activeFrame} opened={Boolean(activeFrame)} onClose={closeDetail} onSave={handleSave} />
      )}
    </Stack>
  );
}
