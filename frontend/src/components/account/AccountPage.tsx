import { useEffect, useMemo, useState } from "react";
import {
  Badge,
  Button,
  Divider,
  Group,
  LoadingOverlay,
  Modal,
  Paper,
  Stack,
  Text,
  TextInput,
  Title,
  useComputedColorScheme,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { IconLock, IconLogout, IconMail, IconShieldCheck, IconTrash, IconUserEdit } from "@tabler/icons-react";
import { Background } from "../layout/Background";
import { PageHero } from "../layout/PageHero";
import { GlassCard } from "../layout/GlassCard";
import { MetricTile } from "../layout/MetricTile";
import { useAuth } from "../../contexts/UserContext";

export function AccountPage() {
  const { user, logout, loading, updateProfile, refreshUser } = useAuth();
  const [saving, setSaving] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutOpen, { open: openLogout, close: closeLogout }] = useDisclosure(false);
  const computedColorScheme = useComputedColorScheme("light", { getInitialValueInEffect: true });
  const isDark = computedColorScheme === "dark";
  const surface = isDark ? "rgba(20, 24, 35, 0.9)" : "rgba(255,255,255,0.92)";
  const surfaceBorder = isDark ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.4)";
  const heroOverlay = isDark
    ? "linear-gradient(145deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))"
    : "linear-gradient(145deg, rgba(255,255,255,0.25), rgba(255,255,255,0.12))";

  const form = useForm({
    initialValues: {
      firstName: user?.firstName ?? "",
      lastName: user?.lastName ?? "",
      email: user?.email ?? "",
      username: user?.username ?? "",
    },
    validate: {
      firstName: (value) => (!value.trim() ? "First name is required" : null),
      email: (value) => (!value.includes("@") ? "Enter a valid email" : null),
      username: (value) => (value.trim().length < 3 ? "Username must be at least 3 characters" : null),
    },
  });

  useEffect(() => {
    form.setValues({
      firstName: user?.firstName ?? "",
      lastName: user?.lastName ?? "",
      email: user?.email ?? "",
      username: user?.username ?? "",
    });
  }, [user]);

  const stats = useMemo(
    () => [
      {
        label: "Signed in as",
        value: user?.username ?? "Guest",
        description: user?.email,
      },
      {
        label: "Role",
        value: user?.admin ? "Admin" : "Member",
        description: user?.admin ? "Full access" : "Standard access",
      },
    ],
    [user],
  );

  const handleSave = async () => {
    const validation = form.validate();
    if (validation.hasErrors) return;
    setSaving(true);
    try {
      const res = await updateProfile(form.values);
      if (!res.success) {
        notifications.show({ title: "Update failed", message: res.data || "Could not save changes", color: "red" });
        return;
      }
      await refreshUser();
      notifications.show({ title: "Profile updated", message: "Your info was saved.", color: "green" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Background p={{ base: "md", md: "xl" }} style={{ minHeight: "100%" }}>
      <Stack gap="xl">
        <PageHero
          overlay={heroOverlay}
          badge={<Badge variant="light" color="blue">Account</Badge>}
      title={
        <Title order={1} size="h2" lh={1.2}>
          Your account, tidy and transparent.
        </Title>
      }
          description={
            <Text c="dimmed" size="sm">
              Update personal details, manage security actions, or sign out—all in one clean panel.
            </Text>
          }
          actions={
            <Group gap="sm" wrap="wrap">
              <Button leftSection={<IconLogout size={16} />} variant="default" onClick={openLogout}>
                Log out
              </Button>
            </Group>
          }
          meta={
            user?.admin ? (
              <Badge variant="light" color="violet">
                Admin
              </Badge>
            ) : null
          }
        />

        <GlassCard radius="lg" p="lg" style={{ background: surface, borderColor: surfaceBorder }}>
          <LoadingOverlay visible={loading || saving} overlayProps={{ blur: 2 }} />
          <Stack gap="lg">
            <Group align="center" justify="space-between">
              <Group gap="sm">
                <IconUserEdit size={18} />
                <Text fw={600}>Basic info</Text>
              </Group>
              <Group gap="xs">
                <Button size="xs" variant="default" onClick={() => form.reset()} disabled={saving}>
                  Reset
                </Button>
                <Button size="xs" onClick={handleSave} loading={saving}>
                  Save changes
                </Button>
              </Group>
            </Group>
            <Divider />
            <Group grow gap="md">
              <TextInput
                label="First name"
                placeholder="First name"
                {...form.getInputProps("firstName")}
              />
              <TextInput
                label="Last name"
                placeholder="Last name"
                {...form.getInputProps("lastName")}
              />
            </Group>
            <Group grow gap="md">
              <TextInput
                readOnly
                label="Email"
                placeholder="you@example.com"
                leftSection={<IconMail size={14} />}
                {...form.getInputProps("email")}
              />
              <TextInput
                readOnly
                label="Username"
                placeholder="your username"
                {...form.getInputProps("username")}
              />
            </Group>
          </Stack>
        </GlassCard>

        <GlassCard radius="lg" p="lg" style={{ background: surface, borderColor: surfaceBorder }}>
          <Stack gap="lg">
            <Group align="center" justify="space-between">
              <Group gap="sm">
                <IconShieldCheck size={18} />
                <Text fw={600}>Security</Text>
              </Group>
              <Badge variant="light" color="gray">
                Password & account actions
              </Badge>
            </Group>
            <Divider />
            <Group grow gap="md">
              <Paper withBorder radius="md" p="md" style={{ borderColor: surfaceBorder, background: "transparent" }}>
                <Stack gap="sm">
                  <Text fw={600} size="sm">Password reset</Text>
                  <Text size="xs" c="dimmed">Contact the administrator for help changing your password.</Text>
                  <Button
                    variant="light"
                    leftSection={<IconLock size={16} />}
                    disabled
                  >
                    Start reset
                  </Button>
                </Stack>
              </Paper>
              <Paper withBorder radius="md" p="md" style={{ borderColor: surfaceBorder, background: "transparent" }}>
                <Stack gap="sm">
                  <Text fw={600} size="sm">Delete account</Text>
                  <Text size="xs" c="dimmed">Contact the administrator to request account and data deletion.</Text>
                  <Button
                    color="red"
                    variant="outline"
                    leftSection={<IconTrash size={16} />}
                    disabled
                  >
                    Request deletion
                  </Button>
                </Stack>
              </Paper>
            </Group>
          </Stack>
        </GlassCard>

        <GlassCard radius="lg" p="lg" style={{ background: surface, borderColor: surfaceBorder }}>
          <Stack gap="md">
            <Text fw={600}>Snapshot</Text>
            <Group grow gap="md">
              {stats.map((item) => (
                <MetricTile
                  key={item.label as string}
                  label={item.label}
                  value={item.value}
                  description={item.description}
                  surfaceColor={surface}
                  borderColor={surfaceBorder}
                  shadow="none"
                />
              ))}
            </Group>
          </Stack>
        </GlassCard>
      </Stack>
      <Modal
        opened={logoutOpen}
        onClose={closeLogout}
        title={<Group gap={8}><IconLogout size={16} /> <Text fw={600}>Log out?</Text></Group>}
        centered
      >
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            You’ll need to sign in again to manage frames or photos. Are you sure you want to log out?
          </Text>
          <Group justify="flex-end" gap="sm">
            <Button variant="default" onClick={closeLogout} disabled={loggingOut}>
              Stay signed in
            </Button>
            <Button
              color="red"
              leftSection={<IconLogout size={14} />}
              loading={loggingOut}
              onClick={async () => {
                setLoggingOut(true);
                const result = await logout();
                setLoggingOut(false);
                if (result.success) {
                  notifications.hide("logout-error");
                  closeLogout();
                } else {
                  notifications.show({
                    id: 'logout-error',
                    title: 'Could not log out',
                    message: 'You are still signed in. Please try again.',
                    color: 'red',
                  });
                }
              }}
            >
              Log out
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Background>
  );
}
