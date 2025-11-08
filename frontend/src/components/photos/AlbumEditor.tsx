import { Box, Modal, Stack, TextInput, Text, Button, Group, Checkbox, Avatar, Badge, ActionIcon, ScrollArea, Drawer, Paper, SimpleGrid, Tooltip } from "@mantine/core";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Album, Collaborator } from "../../types/Photos";
import { IconTrash, IconPhotoPlus, IconCheck, IconX } from "@tabler/icons-react";
import { useIsMobile } from "../../util/LayoutUtil";
import {  usePhotoUploader } from "./PhotoUploader";
import { getUrlFromPhoto } from "../../util/UrlUtil";
import { usePhoto } from "../../contexts/PhotoContext";

type AlbumEditorProps = {
  opened: boolean;
  album: Album;
  onSave: (album: Album, options?: { close?: boolean }) => void;
  onDismiss: () => void;
};

export function AlbumEditor({ opened, album, onSave, onDismiss }: AlbumEditorProps) {
  const [name, setName] = useState(album.name || "Untitled album");
  const [collaborators, setCollaborators] = useState<Collaborator[]>(album.collaborators || []);
  const [inviteEmail, setInviteEmail] = useState("");
  const [photos, setPhotos] = useState(album.photos || []);
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<Set<string>>(new Set());
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [albumDeleteConfirmOpen, setAlbumDeleteConfirmOpen] = useState(false);
  const autosaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipNextSaveRef = useRef(true);
  const hasPendingChangesRef = useRef(false);
  const { openUploader } = usePhotoUploader();
  const { deleteAlbum } = usePhoto();
  const markDirty = useCallback(() => {
    hasPendingChangesRef.current = true;
  }, []);

  const isMobile = useIsMobile();
  const isDraft = useMemo(() => album.id.startsWith("draft-"), [album.id]);

  useEffect(() => {
    setName(album.name || "Untitled album");
    setCollaborators(album.collaborators ? [...album.collaborators] : []);
    setInviteEmail("");
    setPhotos(album.photos ? [...album.photos] : []);
    setSelectedPhotoIds(new Set());
    skipNextSaveRef.current = true;
    hasPendingChangesRef.current = false;
  }, [album.id]);

  const handleRemove = (email: string) => {
    setCollaborators((prev) => prev.filter((c) => c.email !== email));
    markDirty();
  };

  const handleCollaboratorChange = (index: number, update: Partial<Collaborator>) => {
    setCollaborators((prev) =>
      prev.map((collab, i) => (i === index ? { ...collab, ...update } : collab))
    );
    markDirty();
  };

  const handleInvite = () => {
    const email = inviteEmail.trim().toLowerCase();
    if (!email || collaborators.some((c) => c.email === email)) return;
    setCollaborators((prev) => [
      ...prev,
      { email, editor: false, status: "invited" },
    ]);
    setInviteEmail("");
    markDirty();
  };

  const handleNameChange = (value: string) => {
    setName(value);
    markDirty();
  };

  const handleUploadPicture = () => {
    if (isDraft) return;
    openUploader(album, () => {});
  };

  const togglePhotoSelection = (photoId: string) => {
    setSelectedPhotoIds((prev) => {
      const next = new Set(prev);
      if (next.has(photoId)) {
        next.delete(photoId);
      } else {
        next.add(photoId);
      }
      return next;
    });
  };

  const clearSelection = () => setSelectedPhotoIds(new Set());

  const requestDeleteSelectedPhotos = () => {
    if (selectedPhotoIds.size === 0) return;
    setDeleteConfirmOpen(true);
  };

  const handleDeleteSelectedPhotos = () => {
    if (selectedPhotoIds.size === 0) {
      setDeleteConfirmOpen(false);
      return;
    }
    setPhotos((prev) => prev.filter((photo) => !selectedPhotoIds.has(photo.id)));
    setSelectedPhotoIds(new Set());
    setDeleteConfirmOpen(false);
    markDirty();
  };

  const buildAlbumPayload = useCallback((): Album => ({
    id: album.id,
    name: name.trim() || "Untitled album",
    collaborators,
    photos,
  }), [album.id, collaborators, name, photos]);

  useEffect(() => {
    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false;
      return;
    }

    const timeoutId = window.setTimeout(() => {
      onSave(buildAlbumPayload());
       hasPendingChangesRef.current = false;
      if (autosaveTimeoutRef.current === timeoutId) {
        autosaveTimeoutRef.current = null;
      }
    }, 600);

    autosaveTimeoutRef.current = timeoutId;

    return () => {
      clearTimeout(timeoutId);
      if (autosaveTimeoutRef.current === timeoutId) {
        autosaveTimeoutRef.current = null;
      }
    };
  }, [buildAlbumPayload, onSave]);

  const handleClose = () => {
    if (autosaveTimeoutRef.current) {
      clearTimeout(autosaveTimeoutRef.current);
      autosaveTimeoutRef.current = null;
    }
    if (hasPendingChangesRef.current) {
      hasPendingChangesRef.current = false;
      onSave(buildAlbumPayload(), { close: true });
    } else {
      onDismiss();
    }
  };

  const handleAlbumDelete = async () => {
    if (autosaveTimeoutRef.current) {
      clearTimeout(autosaveTimeoutRef.current);
      autosaveTimeoutRef.current = null;
    }
    setAlbumDeleteConfirmOpen(false);
    hasPendingChangesRef.current = false;

    if (isDraft) {
      onDismiss();
      return;
    }

    const res = await deleteAlbum(album.id);
    if (!res.success) {
      return;
    }

    onDismiss();
  };

  const photoCount = photos.length;
  const selectedCount = selectedPhotoIds.size;
  const hasSelection = selectedCount > 0;

  const heroImage =
    photos.length > 0
      ? getUrlFromPhoto(photos[0])
      : "https://images.unsplash.com/photo-1503264116251-35a269479413?auto=format&fit=crop&w=800&q=80";

  const collaboratorSection =
    collaborators.length === 0 ? (
      <Text c="dimmed" size="sm">
        Nobody has access yet. Invite collaborators to share this album.
      </Text>
    ) : (
      <ScrollArea mah={180} scrollbarSize={6}>
        <Stack gap="sm">
          {collaborators.map((c, i) => (
            <Group key={c.email} justify="space-between" gap="sm" align="center">
              <Group gap="sm">
                <Avatar radius="xl" size="md" color="gray">
                  {c.email[0]?.toUpperCase()}
                </Avatar>
                <Stack gap={2}>
                  <Text size="sm" fw={500}>{c.email}</Text>
                  <Badge
                    variant="light"
                    size="xs"
                    color={
                      c.status === "accepted"
                        ? "green"
                        : c.status === "invited"
                          ? "blue"
                          : "gray"
                    }
                  >
                    {c.status}
                  </Badge>
                </Stack>
              </Group>
              <Group gap="xs">
                <Checkbox
                  label="Editor"
                  checked={c.editor}
                  onChange={(e) =>
                    handleCollaboratorChange(i, { editor: e.currentTarget.checked })
                  }
                />
                <ActionIcon
                  variant="light"
                  color="red"
                  onClick={() => handleRemove(c.email)}
                  aria-label={`Remove ${c.email}`}
                >
                  <IconTrash size={16} />
                </ActionIcon>
              </Group>
            </Group>
          ))}
        </Stack>
      </ScrollArea>
    );

  const photosGrid =
    photos.length > 0 ? (
      <SimpleGrid cols={isMobile ? 2 : 4} spacing="sm">
        {photos.map((photo, idx) => {
          const photoId = photo.id ?? String(idx);
          const isSelected = selectedPhotoIds.has(photoId);
          return (
            <Box
              key={photoId}
              aria-pressed={isSelected}
              component="button"
              type="button"
              onClick={() => togglePhotoSelection(photoId)}
              style={{
                borderRadius: 12,
                overflow: "hidden",
                position: "relative",
                paddingBottom: "100%",
                backgroundImage: `url(${getUrlFromPhoto(photo)})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                cursor: "pointer",
                boxShadow: isSelected ? "0 0 0 3px var(--mantine-color-blue-light)" : undefined,
                outline: "none",
                border: "none",
                backgroundColor: "transparent",
              }}
            >
              {isSelected && (
                <Box
                  style={{
                    position: "absolute",
                    inset: 0,
                    backgroundColor: "rgba(13, 110, 253, 0.35)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "white",
                  }}
                >
                  <IconCheck size={32} />
                </Box>
              )}
            </Box>
          );
        })}
      </SimpleGrid>
    ) : (
      <Paper withBorder radius="md" p="lg" ta="center">
        <Text fw={500}>No photos yet</Text>
        <Text size="sm" c="dimmed">
          Upload your first photo to preview the frame layout.
        </Text>
      </Paper>
    );

  const renderAddPhotoButton = () => (
    <Tooltip
      label={isDraft ? "Save your album first to start uploading photos" : "Upload a photo"}
      disabled={!isDraft}
    >
      <Button
        leftSection={<IconPhotoPlus size={16} />}
        variant="light"
        disabled={isDraft}
        onClick={handleUploadPicture}
      >
        Add photo
      </Button>
    </Tooltip>
  );

  const Content = (
    <>
      <Stack gap="lg" style={{ padding: isMobile ? "1rem" : "1.5rem", minHeight: isMobile ? "100%" : 500 }}>
        <Box
          style={{
            position: "relative",
            borderRadius: 20,
            overflow: "hidden",
            minHeight: 200,
            backgroundImage: `url(${heroImage})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          <Box
            style={{
              position: "absolute",
              inset: 0,
              background: "linear-gradient(180deg, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.8) 100%)",
            }}
          />
          <Group
            gap="xs"
            style={{
              position: "absolute",
              top: 16,
              right: 16,
              zIndex: 102,
            }}
          >
            <ActionIcon
              variant="subtle"
              aria-label="Delete album"
              onClick={() => setAlbumDeleteConfirmOpen(true)}
              style={{
                backgroundColor: "rgba(255, 255, 255, 0.15)",
                color: "var(--mantine-color-red-4)",
              }}
            >
              <IconTrash size={16} />
            </ActionIcon>
            <ActionIcon
              variant="subtle"
              aria-label="Close editor"
              onClick={handleClose}
              style={{
                backgroundColor: "rgba(0, 0, 0, 0.45)",
                color: "white",
              }}
            >
              <IconX size={16} />
            </ActionIcon>
          </Group>
          <Stack
            gap="xs"
            style={{
              position: "absolute",
              bottom: 20,
              left: 20,
              right: 20,
              color: "white",
            }}
          >
            <Text size="xs" c="gray.2">
              {photoCount} photo{photoCount === 1 ? "" : "s"}
            </Text>
            <Text fw={600} size="xl">
              {name || "Untitled album"}
            </Text>
            <Group gap="sm">
              {renderAddPhotoButton()}
            </Group>
          </Stack>
        </Box>

        <Paper withBorder radius="lg" p="md">
          <Stack gap="xs">
            <TextInput
              label="Album name"
              placeholder="Give your album a title"
              value={name}
              onChange={(e) => handleNameChange(e.currentTarget.value)}
            />
            <Text size="xs" c="dimmed">
              Friendly titles help you find the right set when sending photos to a frame.
            </Text>
          </Stack>
        </Paper>

        <Paper withBorder radius="lg" p="md">
          <Stack gap="sm">
            <Group align="flex-end" gap="sm">
              <TextInput
                label="Invite collaborators"
                placeholder="name@email.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.currentTarget.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    handleInvite();
                  }
                }}
                style={{ flex: 1 }}
              />
              <Button onClick={handleInvite}>Invite</Button>
            </Group>
            {collaboratorSection}
          </Stack>
        </Paper>

        <Paper withBorder radius="lg" p="md">
          <Stack gap="sm">
            <Group justify="space-between" align="center">
              <Text fw={600}>Photos</Text>
              <Group gap="xs">
                {hasSelection && (
                  <>
                    <Button variant="subtle" size="xs" onClick={clearSelection}>
                      Clear selection
                    </Button>
                    <Button
                      variant="light"
                      color="red"
                      size="xs"
                      onClick={requestDeleteSelectedPhotos}
                    >
                      Delete selected ({selectedCount})
                    </Button>
                  </>
                )}
                {renderAddPhotoButton()}
              </Group>
            </Group>
            {photos.length > 0 && (
              <Text size="xs" c="dimmed">
                Tap photos to select the ones you want to delete.
              </Text>
            )}
            {photosGrid}
          </Stack>
        </Paper>
      </Stack>

    </>
  );

  const deleteConfirmModal = (
    <Modal
      opened={deleteConfirmOpen}
      onClose={() => setDeleteConfirmOpen(false)}
      title="Delete selected photos?"
      centered
      size="sm"
      zIndex={2000}
    >
      <Stack gap="md">
        <Text>
          You are about to permanently delete {selectedCount} photo{selectedCount === 1 ? "" : "s"}. This cannot be undone. Are you sure you want to continue?
        </Text>
        <Group justify="flex-end">
          <Button variant="default" onClick={() => setDeleteConfirmOpen(false)}>
            Cancel
          </Button>
          <Button color="red" onClick={handleDeleteSelectedPhotos}>
            Delete
          </Button>
        </Group>
      </Stack>
    </Modal>
  );

  const deleteAlbumConfirmModal = (
    <Modal
      opened={albumDeleteConfirmOpen}
      onClose={() => setAlbumDeleteConfirmOpen(false)}
      title="Delete this album?"
      centered
      size="sm"
      zIndex={2000}
    >
      <Stack gap="md">
        <Text>
          {isDraft
            ? "This album hasn’t been saved yet. Deleting it will discard all your changes."
            : "Deleting this album removes it and all associated photos from your library. This cannot be undone."}
        </Text>
        <Group justify="flex-end">
          <Button variant="default" onClick={() => setAlbumDeleteConfirmOpen(false)}>
            Cancel
          </Button>
          <Button color="red" onClick={handleAlbumDelete}>
            Delete album
          </Button>
        </Group>
      </Stack>
    </Modal>
  );

  if (isMobile) {
    // Render a fullscreen Drawer or a simple fullscreen Box
    return (
      <>
        <Drawer
          opened={opened}
          onClose={handleClose}
          size="100%"
          position="right"
          withCloseButton={false}
          zIndex={1000}
          overlayProps={{ blur: 4 }}
        >
          {Content}
        </Drawer>
        {deleteConfirmModal}
        {deleteAlbumConfirmModal}
      </>
    );
  }

  return (
    <>
      <Modal
        opened={opened}
        onClose={handleClose}
        size="lg"
        radius="lg"
        centered
        padding={0}
        withCloseButton={false}
      >
        {Content}
      </Modal>
      {deleteConfirmModal}
      {deleteAlbumConfirmModal}
    </>
  );
}


type AlbumEditorContextType = {
  openEditor: (album: Album, onSave?: (updated: Album) => Album | void | Promise<Album | void>) => void;
};

const AlbumEditorContext = createContext<AlbumEditorContextType | undefined>(undefined);

export function useAlbumEditor() {
  const ctx = useContext(AlbumEditorContext);
  if (!ctx) throw new Error("useAlbumEditor must be used within AlbumEditorProvider");
  return ctx;
}

export function AlbumEditorProvider({ children }: { children: React.ReactNode }) {
  const { albums } = usePhoto();
  const [albumId, setAlbumId] = useState<string | null>(null);
  const [opened, setOpened] = useState(false);
  const [onSave, setOnSave] = useState<((a: Album) => Album | void | Promise<Album | void>) | undefined>();
  const [stagedAlbum, setStagedAlbum] = useState<Album | null>(null);

  const openEditor = useCallback((album: Album, onSaveCallback?: (a: Album) => Album | void | Promise<Album | void>) => {
    setAlbumId(album.id);
    setStagedAlbum(album);
    setOnSave(() => onSaveCallback);
    setOpened(true);
  }, []);

  const closeEditor = useCallback(() => {
    setOpened(false);
    setAlbumId(null);
    setStagedAlbum(null);
    setOnSave(undefined);
  }, []);

  const persistAlbum = useCallback((updated: Album, options?: { close?: boolean }) => {
    const maybeResult = onSave?.(updated);

    const finalize = (next?: Album) => {
      const normalized = next ?? updated;
      setStagedAlbum(normalized);
      setAlbumId(normalized.id);
      if (options?.close) {
        closeEditor();
      }
    };

    if (maybeResult && typeof (maybeResult as Promise<Album | void>).then === "function") {
      (maybeResult as Promise<Album | void>)
        .then((value) => finalize(value))
        .catch((error) => {
          console.error("Album save failed", error);
        });
    } else {
      finalize(maybeResult as Album | void);
    }
  }, [closeEditor, onSave]);

  const liveAlbum = albumId ? albums.find(a => a.id === albumId) : null;
  const album = liveAlbum ?? stagedAlbum;

  return (
    <AlbumEditorContext.Provider value={{ openEditor }}>
      {children}
      {album && (
        <AlbumEditor
          album={album}
          opened={opened}
          onDismiss={closeEditor}
          onSave={persistAlbum}
        />
      )}
    </AlbumEditorContext.Provider>
  );
}
