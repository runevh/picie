import { useState } from "react";
import {
  Badge,
  Box,
  Button,
  Group,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  Textarea,
  Title,
  Divider,
  Alert,
  SimpleGrid,
  ThemeIcon,
  Progress,
  SegmentedControl,
  useMantineColorScheme,
  useComputedColorScheme,
} from "@mantine/core";
import {
  IconChecks,
  IconAlertTriangle,
  IconMail,
  IconShieldLock,
  IconSparkles,
  IconUser,
  IconMoon,
  IconSun,
  IconDeviceLaptop,
  IconLogout,
} from "@tabler/icons-react";
import { useAuth } from "../../contexts/UserContext";
import { GlassCard } from "../layout/GlassCard";
import { PageHero } from "../layout/PageHero";

export function AccountPage() {
  const { colorScheme, setColorScheme } = useMantineColorScheme();
  const computedColorScheme = useComputedColorScheme("light", { getInitialValueInEffect: true });
  const { user, logout } = useAuth();
  const [deleteReason, setDeleteReason] = useState("");
  const [changePasswordLoading, setChangePasswordLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const fullName = user ? `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() : "Unknown user";
  const isDark = computedColorScheme === "dark";
  const surfaceBorder = isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(255, 255, 255, 0.45)";
  const heroOverlay = isDark
    ? "linear-gradient(145deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))"
    : "linear-gradient(145deg, rgba(255,255,255,0.25), rgba(255,255,255,0.12))";
  const passwordStrength = Math.min(Math.round((newPassword.length / 14) * 100), 100);
  const passwordStatus =
    passwordStrength >= 80 ? "Looking solid" : passwordStrength >= 50 ? "Keep hardening" : "Start fresh";

  const handlePasswordChange = async () => {
    setChangePasswordLoading(true);
    setTimeout(() => {
      setChangePasswordLoading(false);
      setNewPassword("");
      setConfirmPassword("");
    }, 800);
  };

  const handleRequestDelete = async () => {
    setDeleteLoading(true);
    setTimeout(() => {
      setDeleteLoading(false);
      setDeleteReason("");
    }, 800);
  };

  return (
    <Box
      p={{ base: "md", md: "xl" }}
      style={{
        minHeight: "100%",
        background: isDark
          ? "radial-gradient(circle at 15% 20%, rgba(52, 125, 244, 0.1), transparent 24%)," +
            "radial-gradient(circle at 85% 10%, rgba(132, 94, 247, 0.12), transparent 22%)," +
            "linear-gradient(145deg, #0f1629, #0f172a)"
          : "radial-gradient(circle at 15% 20%, rgba(52, 125, 244, 0.1), transparent 24%)," +
            "radial-gradient(circle at 85% 10%, rgba(132, 94, 247, 0.1), transparent 22%)," +
            "linear-gradient(135deg, #f8fbff, #eef2ff)",
      }}
    >
      <Stack gap="xl">
        <PageHero
          overlay={heroOverlay}
          badge={null}
          title={
            <Title order={1} size="h2" lh={1.2}>
              {fullName || "Account owner"}
            </Title>
          }
          description={
            <Text c="dimmed" size="sm">
              A clearer, more focused space to keep your identity and security in sync.
            </Text>
          }
          meta={
            <Group gap="sm" wrap="wrap">
              <Badge variant="outline" color="gray" leftSection={<IconMail size={14} />}>
                {user?.email ?? "unknown"}
              </Badge>
              {user?.username && (
                <Badge variant="outline" color="gray" leftSection={<IconUser size={14} />}>
                  @{user.username}
                </Badge>
              )}
              <Badge variant="gradient" gradient={{ from: "blue", to: "cyan" }}>
                Synced profile
              </Badge>
            </Group>
          }
          footer={
            <Stack gap={6} w={{ base: "100%", sm: 320 }}>
              <Text size="xs" c="dimmed" fw={600}>
                Appearance
              </Text>
              <SegmentedControl
                value={colorScheme}
                onChange={(value) => setColorScheme(value as "light" | "dark" | "auto")}
                radius="md"
                size="xs"
                fullWidth
                data={[
                  {
                    value: "light",
                    label: (
                      <Group gap={6} justify="center">
                        <IconSun size={14} />
                        <Text size="xs">Light</Text>
                      </Group>
                    ),
                  },
                  {
                    value: "dark",
                    label: (
                      <Group gap={6} justify="center">
                        <IconMoon size={14} />
                        <Text size="xs">Dark</Text>
                      </Group>
                    ),
                  },
                  {
                    value: "auto",
                    label: (
                      <Group gap={6} justify="center">
                        <IconDeviceLaptop size={14} />
                        <Text size="xs">System</Text>
                      </Group>
                    ),
                  },
                ]}
              />
            </Stack>
          }
          aside={
            <GlassCard
              radius="lg"
              p="md"
              surfaceColor={isDark ? "rgba(17, 23, 34, 0.85)" : "rgba(255, 255, 255, 0.82)"}
              borderColor={surfaceBorder}
              blur={8}
              shadow={isDark ? "0 16px 50px -50px rgba(0,0,0,0.7)" : "0 16px 50px -40px rgba(15, 23, 42, 0.5)"}
              style={{ minWidth: 260 }}
            >
              <Group align="flex-start" gap="sm">
                <ThemeIcon variant="light" color="teal">
                  <IconSparkles size={16} />
                </ThemeIcon>
                <Stack gap={4} style={{ flex: 1 }}>
                  <Text fw={600}>Profile snapshot</Text>
                  <Text size="xs" c="dimmed">
                    Identity is up to date. You can adjust details anytime below.
                  </Text>
                  <Group gap="xs" wrap="wrap" mt={6}>
                    <Badge size="sm" variant="light" color="teal">
                      Active session
                    </Badge>
                    <Badge size="sm" variant="light" color="blue">
                      Clean layout
                    </Badge>
                  </Group>
                </Stack>
              </Group>
            </GlassCard>
          }
        />

        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
          <GlassCard
            radius="lg"
            p="lg"
            shadow={isDark ? "0 18px 60px -50px rgba(0,0,0,0.65)" : "0 18px 60px -40px rgba(15, 23, 42, 0.35)"}
            blur={8}
          >
            <Stack gap="md">
              <Group justify="space-between" align="flex-start" wrap="wrap">
                <Group gap="sm">
                  <ThemeIcon variant="light" color="blue">
                    <IconUser size={16} />
                  </ThemeIcon>
                  <Stack gap={2}>
                    <Text size="sm" c="dimmed" fw={600}>
                      Identity
                    </Text>
                    <Text size="xs" c="dimmed">
                      Read-only details from your profile.
                    </Text>
                  </Stack>
                </Group>
              </Group>

              <Divider />

              <Stack gap="sm">
                <TextInput
                  label="Full name"
                  value={fullName}
                  readOnly
                  leftSection={<IconUser size={16} />}
                />
                <TextInput
                  label="Email"
                  value={user?.email ?? "unknown"}
                  readOnly
                  leftSection={<IconMail size={16} />}
                />
                <Group justify="flex-end" mt="xs">
                  <Button variant="default" onClick={logout} leftSection={<IconLogout size={16} />}>
                    Sign off
                  </Button>
                </Group>
              </Stack>
            </Stack>
          </GlassCard>

          <GlassCard
            radius="lg"
            p="lg"
            shadow={isDark ? "0 18px 60px -50px rgba(0,0,0,0.65)" : "0 18px 60px -40px rgba(15, 23, 42, 0.35)"}
            blur={8}
          >
            <Stack gap="md">
              <Group justify="space-between" align="flex-start" wrap="wrap">
                <Group gap="sm">
                  <ThemeIcon variant="light" color="indigo">
                    <IconShieldLock size={16} />
                  </ThemeIcon>
                  <Stack gap={2}>
                    <Text size="sm" c="dimmed" fw={600}>
                      Security
                    </Text>
                    <Text size="xs" c="dimmed">
                      Refresh your password with a clearer, calmer form.
                    </Text>
                  </Stack>
                </Group>
                    <Badge variant="light" color="teal">
                      Live
                    </Badge>
              </Group>

              <Divider />

              <Stack gap="sm">
                <PasswordInput
                  label="New password"
                  placeholder="Enter a new password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.currentTarget.value)}
                />
                <PasswordInput
                  label="Confirm password"
                  placeholder="Repeat the new password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.currentTarget.value)}
                  error={confirmPassword && confirmPassword !== newPassword ? "Passwords do not match" : undefined}
                />

                <Stack gap={4}>
                  <Group justify="space-between">
                    <Text size="xs" c="dimmed">
                      Strength
                    </Text>
                    <Text size="xs" c="dimmed">
                      {passwordStatus}
                    </Text>
                  </Group>
                  <Progress
                    radius="xl"
                    size="sm"
                    striped
                    value={passwordStrength}
                    color={passwordStrength >= 80 ? "teal" : passwordStrength >= 50 ? "blue" : "gray"}
                  />
                </Stack>

                <Group justify="flex-end">
                  <Button
                    leftSection={<IconChecks size={16} />}
                    disabled={!newPassword || newPassword !== confirmPassword}
                    loading={changePasswordLoading}
                    onClick={handlePasswordChange}
                  >
                    Update password
                  </Button>
                </Group>
              </Stack>
            </Stack>
          </GlassCard>
        </SimpleGrid>

        <GlassCard
          radius="xl"
          p="xl"
          surfaceColor={
            isDark
              ? "linear-gradient(135deg, rgba(239, 68, 68, 0.22), rgba(15, 23, 42, 0.8))"
              : "linear-gradient(135deg, rgba(255, 107, 129, 0.18), rgba(255, 255, 255, 0.9))"
          }
          borderColor={isDark ? "rgba(239, 68, 68, 0.4)" : "rgba(255, 107, 129, 0.35)"}
          shadow={isDark ? "0 26px 80px -60px rgba(239, 68, 68, 0.4)" : "0 26px 80px -60px rgba(255, 107, 129, 0.6)"}
        >
          <Stack gap="md">
            <Alert icon={<IconAlertTriangle size={16} />} color="red" variant="light" title="Danger zone">
              Deleting your account removes all associated albums, frames, and collaborators. This action cannot be undone.
            </Alert>

            <Textarea
              label="Tell us why you're leaving"
              placeholder="Optional"
              value={deleteReason}
              onChange={(event) => setDeleteReason(event.currentTarget.value)}
            />

            <Group justify="space-between" align="center" wrap="wrap">
              <Button color="red" loading={deleteLoading} onClick={handleRequestDelete} leftSection={<IconAlertTriangle size={16} />}>
                Request account deletion
              </Button>
            </Group>
          </Stack>
        </GlassCard>
      </Stack>
    </Box>
  );
}
