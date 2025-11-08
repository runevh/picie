import { useState } from "react";
import {
  Badge,
  Box,
  Button,
  Group,
  Paper,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  Textarea,
  Title,
  Divider,
  Alert,
} from "@mantine/core";
import { IconChecks, IconAlertTriangle, IconMail, IconUser } from "@tabler/icons-react";
import { useAuth } from "../../contexts/UserContext";

export function AccountPage() {
  const { user, logout } = useAuth();
  const [deleteReason, setDeleteReason] = useState("");
  const [changePasswordLoading, setChangePasswordLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const fullName = user ? `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() : "Unknown user";

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
    <Stack gap="xl" p="md">
      <Box>
        <Title order={2}>Account</Title>
        <Text c="dimmed" size="sm">
          Manage your profile, security settings, and account lifecycle.
        </Text>
      </Box>

      <Paper withBorder radius="lg" p="lg">
        <Stack gap="md">
          <Group justify="space-between" align="flex-start">
            <Box>
              <Text size="sm" c="dimmed" fw={500}>
                Profile
              </Text>
              <Title order={4} mt={4}>
                {fullName || "Account owner"}
              </Title>
            </Box>
            {user?.admin && <Badge color="yellow">Admin</Badge>}
          </Group>

          <Divider my="sm" />

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
          </Stack>
        </Stack>
      </Paper>

      <Paper withBorder radius="lg" p="lg">
        <Stack gap="md">
          <div>
            <Text size="sm" c="dimmed" fw={500}>
              Change password
            </Text>
            <Text size="xs" c="dimmed">
              Choose a strong, unique password to keep your frames secure.
            </Text>
          </div>

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
      </Paper>

      <Paper withBorder radius="lg" p="lg" bg="var(--mantine-color-red-light)">
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

          <Group justify="space-between" align="center">
            <Button
              variant="default"
              onClick={logout}
            >
              Logout
            </Button>

            <Button
              color="red"
              loading={deleteLoading}
              onClick={handleRequestDelete}
            >
              Request account deletion
            </Button>
          </Group>
        </Stack>
      </Paper>
    </Stack>
  );
}
