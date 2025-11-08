import { Box, Button, Checkbox, Flex, Group, Popover, Select, Stack, Text, TextInput, Title, Paper, ThemeIcon } from "@mantine/core";
import { useIsMobile } from "../../util/LayoutUtil";
import { AlbumCover } from "./AlbumCover";
import { useDisclosure } from "@mantine/hooks";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { IconFilter, IconPhoto, IconPlus, IconUsers, IconSparkles } from "@tabler/icons-react";
import { useAlbumEditor } from "./AlbumEditor";
import { usePhoto } from "../../contexts/PhotoContext";
import { Album } from "../../types/Photos";

export function PhotosPage() {
  const isMobile = useIsMobile();
  const [opened, { toggle, close }] = useDisclosure(false);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("lastModified");
  const [sharedOnly, setSharedOnly] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const { openEditor } = useAlbumEditor();
  const { createAlbum, saveAlbum, albums } = usePhoto();

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

  const openForEdit = (album: Album, mode: "existing" | "draft" = "existing") => {
    let draftIdPromise: Promise<string | null> | null = null;

    openEditor(album, async (updated) => {
      if (mode === "draft") {
        if (!draftIdPromise) {
          draftIdPromise = (async () => {
            const creation = await createAlbum();
            if (!creation.success) {
              return null;
            }
            return creation.data.id as string;
          })();
        }

        const resolvedId = await draftIdPromise;
        if (!resolvedId) {
          draftIdPromise = null;
          return updated;
        }

        const persisted: Album = { ...updated, id: resolvedId };
        await saveAlbum(persisted);
        return persisted;
      }

      await saveAlbum(updated);
      return updated;
    });
  };

  const handleNewAlbum = () => {
    const draftAlbum: Album = {
      id: `draft-${Date.now()}`,
      name: "Untitled album",
      photos: [],
      collaborators: [],
    };
    openForEdit(draftAlbum, "draft");
  };

  const totalPhotos = useMemo(
    () => albums.reduce((sum, album) => sum + album.photos.length, 0),
    [albums]
  );

  const sharedAlbums = useMemo(
    () => albums.filter((album) => (album.collaborators?.length ?? 0) > 0).length,
    [albums]
  );

  const collaboratorCount = useMemo(() => {
    const set = new Set<string>();
    albums.forEach((album) =>
      album.collaborators?.forEach((collab) => {
        if (collab.email) set.add(collab.email);
      })
    );
    return set.size;
  }, [albums]);

  const stats = useMemo(
    () => [
      {
        label: "Albums",
        value: albums.length,
        description: "Curated collections",
        icon: <IconSparkles size={16} />,
      },
      {
        label: "Photos",
        value: totalPhotos,
        description: "Across all albums",
        icon: <IconPhoto size={16} />,
      },
      {
        label: "Shared albums",
        value: sharedAlbums,
        description: "Collaborating with others",
        icon: <IconUsers size={16} />,
      },
      {
        label: "Collaborators",
        value: collaboratorCount,
        description: "People with access",
        icon: <IconUsers size={16} />,
      },
    ],
    [albums.length, collaboratorCount, sharedAlbums, totalPhotos]
  );

  const newAlbumSize = 163 * scale;
  
  return (
    <Stack gap="lg" p="md">
      <Flex justify="space-between" align="flex-start" wrap="wrap" gap="md">
        <Box>
          <Title order={2}>My Albums</Title>
          <Text c="dimmed" size="sm">
            Keep your favorite moments organized, invite collaborators, and send the best ones straight to your frames.
          </Text>
        </Box>
        <Group gap="sm" mt={isMobile ? "sm" : 0}>
          <Button
            px={12}
            variant="light"
            title="Create Album"
            onClick={handleNewAlbum}
            leftSection={<IconPlus size={18} />}
          >
            New album
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
      <Stack gap="md" mb="xl">
        <Group gap="md" wrap="wrap">
          {stats.map(({ label, value, description, icon }) => (
            <StatCard key={label} label={label} value={value} description={description} icon={icon} />
          ))}
        </Group>
      </Stack>
      <Paper withBorder radius="lg" p="md">
        <Box
          ref={containerRef}
          style={{
            display: "flex",
            flexWrap: "wrap",
            width: "100%",
            margin: -8,
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
              onClick={() => openForEdit(album)}
            >
              <AlbumCover album={album} size={163 * scale} />
            </Box>
          ))}

          <Paper
            withBorder
            radius="md"
            style={{
              height: newAlbumSize,
              width: newAlbumSize,
              margin: 8,
              borderStyle: "dashed",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              cursor: "pointer",
              background: "linear-gradient(135deg, rgba(241, 243, 245, 1), rgba(241, 243, 245, 0.6))",
            }}
            onClick={handleNewAlbum}
            role="button"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                handleNewAlbum();
              }
            }}
          >
            <ThemeIcon size="xl" variant="light" radius="xl">
              <IconPlus size={20} />
            </ThemeIcon>
            <Stack gap={0} align="center">
              <Text fw={600}>New album</Text>
              <Text size="xs" c="dimmed">
                Start from scratch
              </Text>
            </Stack>
          </Paper>
        </Box>
      </Paper>
    </Stack>
  );
}

type StatCardProps = {
  label: string;
  value: number;
  description: string;
  icon: ReactNode;
};

function StatCard({ label, value, description, icon }: StatCardProps) {
  return (
    <Paper withBorder radius="md" p="md" style={{ minWidth: 160, flex: "1 1 160px" }}>
      <Group gap="sm">
        <ThemeIcon variant="light" radius="md" color="gray">
          {icon}
        </ThemeIcon>
        <Stack gap={2} style={{ minWidth: 0 }}>
          <Text size="xs" c="dimmed" tt="uppercase">
            {label}
          </Text>
          <Text fw={600} size="lg">
            {value}
          </Text>
          <Text size="xs" c="dimmed">
            {description}
          </Text>
        </Stack>
      </Group>
    </Paper>
  );
}
