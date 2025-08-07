import { Box, Button, Checkbox, Flex, Group, Popover, Select, Stack, Text, TextInput, Title } from "@mantine/core";
import { useIsMobile } from "../../util/LayoutUtil";
import { AlbumCover } from "./AlbumCover";
import { useDisclosure } from "@mantine/hooks";
import { useEffect, useRef, useState } from "react";
import { IconFilter, IconPlus } from "@tabler/icons-react";
import { useAlbumEditor } from "./AlbumEditor";
import { usePhoto } from "../../contexts/PhotoContext";

export function PhotosPage() {
  const isMobile = useIsMobile();
  const [opened, { toggle, close }] = useDisclosure(false);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("lastModified");
  const [sharedOnly, setSharedOnly] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const { openEditor } = useAlbumEditor();
  const { createAlbum, albums } = usePhoto();

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateScale = () => {
      const containerWidth = container.offsetWidth;
      const baseCardSize = 163 + 16;

      if (containerWidth) {
        const cardsPerRow = Math.floor(containerWidth / baseCardSize);
        if (cardsPerRow > 0) {
          const totalGap = 16 * cardsPerRow;
          const newCardWidth = (containerWidth - totalGap) / cardsPerRow;
          const newScale = newCardWidth / 163;
          setScale(newScale);
        }
      }
    };

    updateScale();

    window.addEventListener("resize", updateScale);

    const resizeObserver = new ResizeObserver(() => {
      updateScale();
    });
    resizeObserver.observe(container);

    return () => {
      window.removeEventListener("resize", updateScale);
      resizeObserver.disconnect();
    };
  }, []);

  const handleNewAlbum = async () => {
    const res = await createAlbum();
    if (res.success) {
      openEditor(res.data, (_u) => {})
    } else {
      //TODO: Show error message
    }
  }

  
  return (
    <Box p="md">
      <Flex justify="space-between" align="center" mb="xl">
        <Title fw={500} size={30}>My Albums</Title>
        <Group gap="sm" mt={isMobile ? "sm" : 0}>
          <Button px={12} variant="light" title="Create Album">
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
    
      <Flex>
        <Box
          ref={containerRef}
          style={{
            display: "inline-flex",
            flexWrap: "wrap",
            width: "fit-content",
            margin: -8,           // negative margin equal to half of gap
          }}
        >
          {albums.map((album) => (
            <Box
              key={album.id}
              style={{
                width: 163 * scale,
                height: 163 * scale,
                margin: 8,
              }}
              onClick={() => openEditor(album, (_u) => {})}
            >
              <AlbumCover album={album} size={163 * scale} />
            </Box>
          ))}
          {/* Optional: Add Album card */}
          <Box
            style={{
              height: 163 * scale,
              margin: 8,
              width: 163 * scale,
              border: "2px dashed #ccc",
              borderRadius: 8,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <Text c="dimmed" onClick={handleNewAlbum}>+ New Album</Text>
          </Box>
        </Box>
      </Flex>
    </Box>
  );
}