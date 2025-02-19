import { Paper, Text, Button, TextInput, Stack, Notification, PasswordInput, Group, Anchor, Container, LoadingOverlay } from '@mantine/core';
import { isEmail, useForm } from '@mantine/form';
import { useToggle } from '@mantine/hooks';
import { useAuth } from '../contexts/UserContext';
import { useState } from 'react';
import { IconX } from '@tabler/icons-react';

function Login() {
    const { register, login } = useAuth();
    const [type, toggle] = useToggle(['login', 'register']);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(undefined);

    const form = useForm({
        initialValues: {
            email: 'runevanhuffel@gmail.com',
            name: 'Rune Van Huffel',
            password: 'test123',
            username: 'rune',
        },
        validate: {
            email: isEmail('Invalid email'),
            password: (val) => (val.length <= 6 ? 'Password should include at least 6 characters' : null),
            username: (val) => !/^(?=(.*[a-z]){3,})[a-z0-9_.]{3,16}$/.test(val) ? 'Username must be 3-16 characters and contain at least 3 characters and _ and .' : null,
            name: (val) => !/^[A-Za-z\s]+$/.test(val) ? 'Name only can contain letters and spaces' : null
        },
    });

    const onSubmit = () => {

        setSubmitting(true);

        if (type === 'register') {
            const [firstName, ...lastNameParts] = form.values.name.split(" ");
            const lastName: string = lastNameParts.length > 0 ? lastNameParts.join(" ") : "";
            register(form.values.username, form.values.email, form.values.password, firstName, lastName).then((res) => {
                if (!res.success) {
                    setError(res.data);
                }
                setSubmitting(false);
            });
        } else {
            login(form.values.username, form.values.password).then(res => {
                console.log(res);
                setSubmitting(false);
            })
        }
    }

    return (
        <>
            <Container size={420} my={60}>

                <Paper shadow="xs" p="xl" withBorder radius={10}>

                    <LoadingOverlay visible={submitting} zIndex={1000} overlayProps={{ radius: "sm", blur: 1 }} />
                    <Text size="xl" fw={500}>
                        Welcome to <Text component="span" c="blue">Picie</Text>!
                    </Text>

                    <Text size="md" fw={300} mb={20}>
                        Your smart picture-frame managing platform
                    </Text>

                    <Notification mb={10} icon={<IconX size={20} />} color="red" title="Error while signing in!" display={error ? '' : 'none'} onClose={() => setError(undefined)}>
                        {error}
                    </Notification>

                    <form onSubmit={form.onSubmit(() => onSubmit())}>
                        <Stack>
                            {type === 'register' && (
                                <>
                                    <TextInput
                                        label="Name"
                                        placeholder="Your name"
                                        value={form.values.name}
                                        onChange={(event) => form.setFieldValue('name', event.currentTarget.value)}
                                        error={form.errors.name && 'Name only can contain letters and spaces'}
                                        required
                                    />
                                    <TextInput
                                        label="Username"
                                        placeholder="Your username"
                                        value={form.values.username}
                                        onChange={(event) => form.setFieldValue('username', event.currentTarget.value)}
                                        error={form.errors.username && 'Username must be 3-16 characters and contain at least 3 characters and numbers and _ and .'}
                                        required
                                    />

                                    <TextInput
                                        required
                                        label="Email"
                                        placeholder="johndoe@email.com"
                                        value={form.values.email}
                                        onChange={(event) => form.setFieldValue('email', event.currentTarget.value)}
                                        error={form.errors.email && 'Invalid email'}
                                        radius="md"
                                    />
                                </>
                            )}

                            {
                                type === 'login' && (
                                    <TextInput
                                        required
                                        label="Email / username"
                                        placeholder="johndoe@email.com"
                                        value={form.values.username}
                                        onChange={(event) => form.setFieldValue('username', event.currentTarget.value)}
                                        radius="md"
                                    />
                                )
                            }

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