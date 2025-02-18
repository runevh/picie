import { Paper, Text, Button, TextInput, Stack, PasswordInput, Group, Anchor, Container } from '@mantine/core';
import {isEmail, useForm } from '@mantine/form';
import { useToggle } from '@mantine/hooks';

function Login() {
    const [type, toggle] = useToggle(['login', 'register']);

    const form = useForm({
        initialValues: {
            email: '',
            name: '',
            password: ''
          },
        validate: {
            email: isEmail('Invalid email'),
            password: (val) => (val.length <= 6 ? 'Password should include at least 6 characters' : null),
        },
    });

    return (
        <>
            <Container size={420} my={60}>
                <Paper shadow="xs" p="xl" withBorder radius={10}>
                    <Text size="xl" fw={500}>
                        Welcome to <Text component="span" c="blue">Picie</Text>!
                    </Text>

                    <Text size="md" fw={300} mb={20}>
                        Your smart picture-frame managing platform 
                    </Text>
                    <form onSubmit={form.onSubmit(() => {})}>
                        <Stack>
                            {type === 'register' && (
                                <TextInput
                                    label="Name"
                                    placeholder="Your name"
                                    value={form.values.name}
                                    onChange={(event) => form.setFieldValue('name', event.currentTarget.value)}
                                    required
                                />
                            )}

                            <TextInput
                                required
                                label="Email"
                                placeholder="johndoe@email.com"
                                value={form.values.email}
                                onChange={(event) => form.setFieldValue('email', event.currentTarget.value)}
                                error={form.errors.email && 'Invalid email'}
                                radius="md"
                            />

                            <PasswordInput
                                required
                                label="Password"
                                placeholder="Your password"
                                value={form.values.password}
                                onChange={(event) => form.setFieldValue('password', event.currentTarget.value)}
                                error={form.errors.password && 'Password should include at least 6 characters'}
                                radius="md"
                            />
                        </Stack>
                        <Group justify="space-between" mt="xl">
                        <Anchor component="button" type="button" c="dimmed" onClick={() => toggle()} size="xs">
                            {type === 'register'
                                ? 'Already have an account? Login'
                                : "Don't have an account? Register"}
                        </Anchor>
                        <Button type="submit" radius="xl">
                            {type === 'register'
                                ? 'Register'
                                : "Login"}
                        </Button>
                    </Group>
                    </form>
                </Paper>
            </Container>
        </>

    );
}

export default Login;