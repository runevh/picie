import {
  Anchor,
  Button,
  Container,
  Divider,
  Group,
  LoadingOverlay,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  Title,
  useComputedColorScheme,
} from '@mantine/core';
import { isEmail, useForm } from '@mantine/form';
import { useToggle } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { useAuth } from '../contexts/UserContext';
import { useState } from 'react';
import { IconX } from '@tabler/icons-react';
import { Background } from './layout/Background';
import { GlassCard } from './layout/GlassCard';
import { AddToHomeBanner } from './AddToHomeBanner';

export function Login() {
  const { register, login } = useAuth();
  const [type, toggle] = useToggle(['login', 'register']);
  const [submitting, setSubmitting] = useState(false);
  const inputSizes = { size: 'md', styles: { input: { fontSize: 16 }, label: { fontSize: 14 } } };
  const computedColorScheme = useComputedColorScheme('light', { getInitialValueInEffect: true });
  const isDark = computedColorScheme === 'dark';
  const surface = isDark ? 'rgba(20, 24, 35, 0.9)' : 'rgba(255,255,255,0.92)';
  const surfaceBorder = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.35)';
  const heroOverlay = isDark
    ? 'linear-gradient(145deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))'
    : 'linear-gradient(145deg, rgba(255,255,255,0.25), rgba(255,255,255,0.12))';

  const form = useForm({
    initialValues: {
      email: '',
      name: '',
      password: '',
      username: '',
    },
    validate: (values) => {
      const errors: Record<string, string | null> = {};

      if (type === 'register') {
        if (!values.name.trim()) errors.name = 'Full name is required';
        else if (!/^[A-Za-z\s]+$/.test(values.name)) errors.name = 'Name can only contain letters and spaces';

        if (!values.username.trim()) errors.username = 'Username is required';
        else if (!/^(?=(.*[a-z]){3,})[a-z0-9_.]{3,16}$/.test(values.username)) {
          errors.username = 'Use 3-16 lowercase letters/numbers; _ and . allowed';
        }

        if (!values.email.trim()) errors.email = 'Email is required';
        else {
          const emailError = isEmail('Enter a valid email address')(values.email);
          if (emailError) errors.email = emailError;
        }

        if (!values.password) errors.password = 'Password is required';
        else if (values.password.length < 6) errors.password = 'Password must be at least 6 characters';
      }

      if (type === 'login') {
        if (!values.username.trim()) {
          errors.username = 'Email or username is required';
        } else if (values.username.includes('@')) {
          const emailError = isEmail('Enter a valid email address')(values.username);
          if (emailError) errors.username = emailError;
        } else if (values.username.length < 3) {
          errors.username = 'Username must be at least 3 characters';
        }

        if (!values.password) errors.password = 'Password is required';
        else if (values.password.length < 6) errors.password = 'Password must be at least 6 characters';
      }

      return errors;
    },
  });

  const showError = (message: string) => {
    // Only one error notification at a time
    notifications.clean();
    notifications.show({
      title: type === 'register' ? 'Could not create account' : 'Could not sign in',
      message,
      color: 'red',
      icon: <IconX size={16} />,
      withCloseButton: true,
    });
  };

  const onSubmit = async () => {
    const validation = form.validate();
    if (validation.hasErrors) {
      const firstError = Object.values(validation.errors).find(Boolean);
      if (firstError) showError(firstError as string);
      return;
    }

    setSubmitting(true);

    try {
      if (type === 'register') {
        const [firstName, ...lastNameParts] = form.values.name.split(' ');
        const lastName: string = lastNameParts.length > 0 ? lastNameParts.join(' ') : '';

        const res = await register(
          form.values.username.trim(),
          form.values.email.trim(),
          form.values.password,
          firstName,
          lastName
        );

        if (!res.success) showError(res.data || 'Something went wrong while creating your account');
      } else {
        const res = await login(form.values.username.trim(), form.values.password);
        if (!res.success) showError(res.data || 'Invalid email/username or password');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Background
      fullHeight
      px="md"
      py={{ base: 'md', md: 64 }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'md',
      }}
    >
      <Container
        size="sm"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 'md',
        }}
      >
        <AddToHomeBanner />
        <GlassCard
          p={{ base: 'md', md: 'xl' }}
          overlay={heroOverlay}
          style={{
            width: '100%',
            maxWidth: 520,
          }}
        >
          <LoadingOverlay visible={submitting} zIndex={1000} overlayProps={{ radius: 'sm', blur: 1 }} />
            <Stack gap={{ base: 'md', md: 'lg' }} style={{ position: 'relative', zIndex: 1 }}>
              <Stack gap={{ base: 'xs', md: 'sm' }}>
                <Title order={2}>Sign in to continue</Title>
                <Text c="dimmed" size="sm" maw={520}>
                  Manage frames, curate albums, and keep collaborators in sync—all from the same glassy surface you see across the app.
                </Text>
              </Stack>

            <Divider label={type === 'register' ? 'Create a new account' : 'Welcome back'} labelPosition="center" />

            <form onSubmit={form.onSubmit(() => onSubmit())}>
              <Stack gap={{ base: 'sm', md: 'md' }}>
                {type === 'register' && (
                  <>
                    <TextInput
                      {...inputSizes}
                      label="Full name"
                      placeholder="Your name"
                      value={form.values.name}
                      onChange={(event) => form.setFieldValue('name', event.currentTarget.value)}
                      error={form.errors.name}
                      required
                    />
                    <TextInput
                      {...inputSizes}
                      label="Username"
                      placeholder="Choose a username"
                      value={form.values.username}
                      onChange={(event) => form.setFieldValue('username', event.currentTarget.value)}
                      error={form.errors.username}
                      required
                    />

                    <TextInput
                      {...inputSizes}
                      required
                      label="Email"
                      placeholder="you@example.com"
                      value={form.values.email}
                      onChange={(event) => form.setFieldValue('email', event.currentTarget.value)}
                      error={form.errors.email}
                      radius="md"
                    />
                  </>
                )}

                {type === 'login' && (
                  <TextInput
                    {...inputSizes}
                    required
                    label="Email or username"
                    placeholder="you@example.com"
                    value={form.values.username}
                    onChange={(event) => form.setFieldValue('username', event.currentTarget.value)}
                    error={form.errors.username}
                    radius="md"
                  />
                )}

                <PasswordInput
                  {...inputSizes}
                  required
                  label="Password"
                  placeholder="Your password"
                  value={form.values.password}
                  onChange={(event) => form.setFieldValue('password', event.currentTarget.value)}
                  error={form.errors.password}
                  radius="md"
                />
              </Stack>
              <Group justify="space-between" mt="xl">
                <Anchor component="button" type="button" c="dimmed" onClick={() => toggle()} size="sm">
                  {type === 'register'
                    ? 'Already have an account? Login'
                    : "Don't have an account? Register"}
                </Anchor>
                <Button type="submit" radius="xl">
                  {type === 'register' ? 'Register' : 'Login'}
                </Button>
              </Group>
            </form>
          </Stack>
        </GlassCard>
      </Container>
    </Background>
  );
}

export default Login;
