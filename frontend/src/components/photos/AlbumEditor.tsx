import { Box, Modal, Stack, TextInput, Text, Button, Group, Checkbox, Divider, Avatar, Title, Badge, ActionIcon, Flex, ScrollArea, Drawer } from "@mantine/core";
import { createContext, useCallback, useContext, useState } from "react";
import { Album, Collaborator } from "../../types/Photos";
import { IconTrash } from "@tabler/icons-react";
import { useIsMobile } from "../../util/LayoutUtil";
import {  usePhotoUploader } from "./PhotoUploader";
import { getUrlFromPhoto } from "../../util/UrlUtil";
import { usePhoto } from "../../contexts/PhotoContext";

type AlbumEditorProps = {
  opened: boolean;
  onClose: () => void;
  album: Album;
  onSave: (album: Album) => void;
};

export function AlbumEditor({ opened, onClose, album, onSave }: AlbumEditorProps) {
  const [name, setName] = useState(album.name);
  const [collaborators, setCollaborators] = useState<Collaborator[]>(album.collaborators || []);
  const [inviteEmail, setInviteEmail] = useState("");
  const [scale, setScale] = useState(1);
  const { openUploader } = usePhotoUploader();

  const isMobile = useIsMobile();

  const handleRemove = (email: string) => {
    setCollaborators((prev) => prev.filter((c) => c.email !== email));
  };

  const handleSave = () => {
    onSave({ id: album.id, name: name, photos: album.photos, collaborators });
    onClose();
  };


  const handleUploadPicture = () => {
    openUploader(album, () => {});
  };


  const Content = (
    <>
      <Stack gap="lg" style={{ padding: isMobile ? '1rem' : '0 1.5rem' }}>
        <ScrollArea style={{ flex: 1 }}>
          {/* Scrollable main content */}
          <Stack gap="lg" style={{ minWidth: 0 }}>
            <Box>
              <TextInput
                label="Album Name"
                value={name}
                onChange={(e) => setName(e.currentTarget.value)}
                size="sm"
                radius="md"
              />
            </Box>

            <Stack gap="sm">
              {/* Collaborators invite input */}
              <Group align="center">
                <TextInput
                  label="Collaborators"
                  placeholder="Invite by email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.currentTarget.value)}
                  size="sm"
                  radius="md"
                  style={{ flex: 1 }}
                />
                <Button size="sm" mt={25} onClick={() => {/* invite logic here */ }}>
                  Invite
                </Button>
              </Group>

              {/* Collaborators list */}
              <ScrollArea mah={150} scrollbarSize={6} offsetScrollbars>
                {collaborators.map((c, i) => (
                  <Flex key={c.email} py={6} align="center">
                    <Group gap="sm" style={{ flex: 1 }}>
                      <Avatar radius="xl" size="md" color="gray">
                        {c.email[0].toUpperCase()}
                      </Avatar>
                      <Box>
                        <Text size="sm" fw={500}>
                          {c.email}
                        </Text>
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
                      </Box>
                    </Group>

                    <Group gap="xs">
                      <Checkbox
                        label="Editor"
                        checked={c.editor}
                        onChange={(e) =>
                          handleCollaboratorChange(i, { editor: e.currentTarget.checked })
                        }
                        mr={5}
                      />
                      <ActionIcon
                        variant="light"
                        color="red"
                        onClick={() => handleRemove(c.email)}
                      >
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Group>
                  </Flex>
                ))}
              </ScrollArea>
            </Stack>

            <Divider label="Photos" labelPosition="center" my="sm" />
            <Group gap="xs" align="center" mb={"md"}>
              {album.photos.length > 0 ? (
                album.photos.map((photo, i) => (
                  <img
                    key={i}
                    src={getUrlFromPhoto(photo)}
                    alt={`Photo ${i + 1}`}
                    style={{
                      width: 120 * scale,
                      height: 120 * scale,
                      borderRadius: 8,
                      objectFit: "cover",
                      cursor: "pointer",
                    }}
                  />
                ))
              ) : (
                <Text c="dimmed" size="sm" style={{ paddingLeft: 10 }}>
                  No photos added yet
                </Text>
              )}

              <Box
                style={{
                  height: 120 * scale,
                  margin: 8,
                  width: 120 * scale,
                  border: "2px dashed #ccc",
                  borderRadius: 8,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                }}
              >
                <Text c="dimmed" onClick={handleUploadPicture}>+ Add Photo</Text>
              </Box>
            </Group>
          </Stack>
        </ScrollArea>
      </Stack>

      <Box
        style={(theme) => ({
          borderTop: `1px solid ${theme.colors.gray[3]}`,
          padding: theme.spacing.sm,
          backgroundColor: theme.white,
          position: "sticky",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 1000,
          display: 'flex',
          justifyContent: 'flex-end',
          gap: theme.spacing.md,
        })}
      >
        <Button variant="default" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="light" color="red" onClick={onClose}>
          Delete
        </Button>
        <Button onClick={handleSave}>Save Changes</Button>
      </Box>
    </>
  );

  if (isMobile) {
    // Render a fullscreen Drawer or a simple fullscreen Box
    return (
      <Drawer
        opened={opened}
        onClose={onClose}
        size="100%"
        position="right"
        withCloseButton={true}
        zIndex={1000}
        overlayProps={{ blur: 4 }}
      >
        {Content}
      </Drawer>
    );
  }

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      size="lg"
      radius="lg"
      centered
      padding={0}
    >
      {Content}
    </Modal>
  );
}


type AlbumEditorContextType = {
  openEditor: (album: Album, onSave?: (updated: Album) => void) => void;
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
  const [onSave, setOnSave] = useState<((a: Album) => void) | undefined>();

  const openEditor = useCallback((album: Album, onSaveCallback?: (a: Album) => void) => {
    setAlbumId(album.id);
    setOnSave(() => onSaveCallback);
    setOpened(true);
  }, []);

  const handleSave = (updated: Album) => {
    onSave?.(updated);
    setOpened(false);
  };

  const album = albums.find(a => a.id === albumId) ?? null;

  return (
    <AlbumEditorContext.Provider value={{ openEditor }}>
      {children}
      {album && (
        <AlbumEditor
          album={album}
          opened={opened}
          onClose={() => setOpened(false)}
          onSave={handleSave}
        />
      )}
    </AlbumEditorContext.Provider>
  );
}