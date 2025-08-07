const mockFrames = [
  {
    name: "Living Room Frame",
    description: "Main frame in the living room displaying family photos.",
    activeImage: "https://webcdn.smint.io/media/1534471.jpg",
    status: "online",
    currentAlbum: "Family Vacation 2024",
    sharedWith: ["alice@example.com", "bob@example.com"],
  },
  {
    name: "Bedroom Frame",
    description: "Cozy frame with relaxing nature scenes. LONGGGGgsuildfhljshdfslfdhlskjdfhsakljdfhyig laisdfhsklhdbf aks iauhefioawe awoeijhf awoiughaiwehfkla sdfhja sduifha lsfj",
    activeImage: "https://webcdn.smint.io/media/1534471.jpg",
    status: "offline",
    currentAlbum: "Nature Walks",
    sharedWith: [],
  },
  {
    name: "Office Frame",
    description: "Frame in the home office, showing work-related photos.",
    activeImage: "https://webcdn.smint.io/media/1534471.jpg",
    status: "offline",
    currentAlbum: "Work Highlights",
    sharedWith: ["carol@example.com"],
  },
];

import { Box, Button, Checkbox, Flex, Group, Popover, Select, Stack, TextInput, Title } from "@mantine/core";
import { FrameCover } from "./FramCover";
import { IconFilter, IconPlus } from "@tabler/icons-react";
import { useIsMobile } from "../../util/LayoutUtil";
import { useDisclosure } from "@mantine/hooks";
import { useState } from "react";
import { useFrameAdder } from "./FrameAdder";

export function FramesPage() {

  const isMobile = useIsMobile();
  const [opened, { toggle, close }] = useDisclosure(false);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("lastModified");
  const [sharedOnly, setSharedOnly] = useState(false);

  const { openFrameAdder } = useFrameAdder();

  return (
    <Box p="md">
      <Flex justify="space-between" align="center" mb="xl">
        <Title fw={500} size={30}>My Albums</Title>
        <Group gap="sm" mt={isMobile ? "sm" : 0}>
          <Button px={12} variant="light" title="Create Album" onClick={openFrameAdder}>
            <IconPlus size={18} />
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
                  placeholder="Album title..."
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
      <Stack gap="md">
        {mockFrames.map((frame) => (
          <FrameCover key={frame.name} frame={frame} />
        ))}
      </Stack>
    </Box>
  );
}