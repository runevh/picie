import { ActionIcon, Group, Paper, Text } from '@mantine/core';
import { IconX, IconShare } from '@tabler/icons-react';
import { useEffect, useState } from 'react';

const STORAGE_KEY = 'a2hs-dismissed-v1';

const isIosSafari = () => {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /iphone|ipad|ipod/i.test(ua);
};

const isStandalone = () => {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as any).standalone === true;
};

export function AddToHomeBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem(STORAGE_KEY) === 'true';
    if (!dismissed && isIosSafari() && !isStandalone()) {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    setVisible(false);
  };

  return (
    <Paper shadow="sm" radius="md" p="sm" mb="md" withBorder>
      <Group align="start" gap="sm" wrap="nowrap">
        <IconShare size={20} style={{ flexShrink: 0, marginTop: 2 }} />
        <div style={{ flex: 1 }}>
          <Text fw={600} size="sm">Add Picie to your Home Screen</Text>
          <Text size="sm" c="dimmed">
            For a full-screen, no-address-bar experience: tap Share, then choose “Add to Home Screen”.
          </Text>
        </div>
        <ActionIcon variant="subtle" aria-label="Dismiss add to home prompt" onClick={dismiss}>
          <IconX size={18} />
        </ActionIcon>
      </Group>
    </Paper>
  );
}

export default AddToHomeBanner;
