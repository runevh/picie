import { createContext, ReactElement, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useIsMobile } from "../../util/LayoutUtil";
import {
  Modal,
  Drawer,
  Button,
  TextInput,
  Group,
  Stack,
  Text,
  Paper,
  Badge,
  Checkbox,
  Select,
  Stepper,
  ScrollArea,
  Box,
  PinInput,
  Flex,
  Center,
} from "@mantine/core";
import { IconEPassport, IconLink, IconLock, IconQrcode } from "@tabler/icons-react";
import { StatusLoader } from "../../misc/StatusLoader";
import { useDeviceContext } from "../../contexts/DeviceContext";
import { notifications } from "@mantine/notifications";

import { PairingSession } from "../../services/DeviceService";

type FrameAdderProps = {
  opened: boolean;
  onClose: () => void;
};

const drawerSafeAreaStyles = {
  content: { paddingTop: "var(--safe-area-top)" },
  header: { paddingTop: "var(--safe-area-top)" },
} as const;

export function FrameAdder({ opened, onClose }: FrameAdderProps) {
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingContent, setLoadingContent] = useState<ReactElement | null>(null);

  const [deviceCode, setDeviceCode] = useState("");
  const [deviceCodeError, setDeviceCodeError] = useState<string | null>(null);

  const [confirmationCode, setConfirmationCode] = useState("");
  const [confirmationCodeError, setConfirmationCodeError] = useState<string | null>(null);

  const [expiryTimestamp, setExpiryTimestamp] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [frameId, setFrameId] = useState<string | null>(null);
  const [attemptsLeft, setAttemptsLeft] = useState<number | null>(null);
  const [waitingForCode, setWaitingForCode] = useState(false);
  const [pollingStatus, setPollingStatus] = useState<string | null>(null);
  const sessionRef = useRef(0);
  const pairingRef = useRef<PairingSession | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);


  const isMobile = useIsMobile();
  const { startPairing, endClaimDevice, cancelPairing, getDeviceStatus } = useDeviceContext();

  const cancelCurrentPairing = useCallback(async () => {
    const session = pairingRef.current;
    pairingRef.current = null;
    if (session) await cancelPairing(session);
  }, [cancelPairing]);

  const canGoNext = () => {
    if (active === 0) {
      return /^\d{6}$/.test(deviceCode); // exactly 6 digits
    }
    if (active === 1) {
      if (waitingForCode || timeLeft <= 0) return false;
      return confirmationCode.length === 4;
    }
    // Add other step validations here if needed
    return true;
  };

  const resetWizard = () => {
    sessionRef.current += 1;
    setActive(0);
    setLoading(false);
    setLoadingContent(null);
    setDeviceCode("");
    setDeviceCodeError(null);
    setConfirmationCode("");
    setConfirmationCodeError(null);
    setExpiryTimestamp(null);
    setTimeLeft(0);
    setFrameId(null);
    setAttemptsLeft(null);
    setWaitingForCode(false);
    setPollingStatus(null);
    setErrorBanner(null);
  };

  useEffect(() => {
    if (!opened) {
      resetWizard();
      cancelCurrentPairing().catch(() => {});
    }
  }, [opened, cancelCurrentPairing]);

  // Ensure pairing is cancelled if the component unmounts (e.g., navigation)
  useEffect(() => {
    return () => {
      sessionRef.current += 1;
      cancelCurrentPairing().catch(() => {});
    };
  }, [cancelCurrentPairing]);

  useEffect(() => {
    if (!waitingForCode || !deviceCode) return;

    const interval = setInterval(async () => {
      try {
        const res = await getDeviceStatus(deviceCode);
        if (res.success) {
          const status = (res.data as any)?.data?.status || (res.data as any)?.status;
          setPollingStatus(status);
          if (status === "idle") {
            setWaitingForCode(false);
            setLoading(false);
            setLoadingContent(null);
          }
        } else {
          setPollingStatus(null);
        }
      } catch {
        setPollingStatus(null);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [waitingForCode, deviceCode, getDeviceStatus]);

  const handleNext = async () => {
    if (!canGoNext()) {
      if (active === 0) setDeviceCodeError("Please enter a valid 6-digit code");
      if (active === 1) setConfirmationCodeError("Confirmation code cannot be empty");
      return;
    }

    if (active === 0) {
      const sessionToken = sessionRef.current;
      setLoading(true);
      // After step 1, show loading before moving to step 2
      setLoadingContent(<>Fetching device info...</>);

      const res = await startPairing(deviceCode);
      if (sessionToken !== sessionRef.current || !opened) {
        if (res.success) await cancelPairing(res.data.data);
        return;
      }
      setLoading(false);

      if (res.success) {
        const session: PairingSession = res.data.data;
        pairingRef.current = session;
        setExpiryTimestamp(session.expiresAt);
        setTimeLeft(Math.max(0, Math.ceil((session.expiresAt - Date.now()) / 1000)));
        setErrorBanner(null);
        setActive((current) => current + 1);
        setWaitingForCode(true);
        setLoading(true);
        setLoadingContent(<>Generating code...</>);
        setDeviceCodeError(null);
      } else {
        const message = typeof res.data === "string"
          ? res.data
          : (res.data as any)?.message || "Unable to start pairing";
        setDeviceCodeError(message);
        setErrorBanner(message);
      }
      setConfirmationCodeError(null);
    }

    if (active === 1) {
      const session = pairingRef.current;
      if (!session) return;
      setLoading(true);
      setLoadingContent(<>Finishing pairing...</>);
      const token = sessionRef.current;
      const res = await endClaimDevice(confirmationCode, session);
      if (token !== sessionRef.current) return;
      setLoading(false);

      if (res.success) {
        pairingRef.current = null;
        setExpiryTimestamp(null);
        setErrorBanner(null);
        const payload = (res.data as any)?.data || res.data;
        const id = payload?.id || payload?.uuid || null;
        setFrameId(id);
        setActive((current) => current + 1);
        setConfirmationCodeError(null);
        notifications.show({ title: "Frame linked", message: "Your frame was added successfully.", color: "green" });
        window.dispatchEvent(new CustomEvent("frame-paired"));
      } else {
        const message = typeof res.data === "string"
          ? res.data
          : (res.data as any)?.message || "Unable to complete pairing";

        const attemptsMatch = message.match(/(\d+)\s+attempt/);
        if (attemptsMatch) {
          setAttemptsLeft(parseInt(attemptsMatch[1], 10));
        }

        setConfirmationCodeError(message);
        setErrorBanner(message);
      }
    }
  }

  // Update countdown every second
  useEffect(() => {
    if (!expiryTimestamp) return;

    const interval = setInterval(() => {
      const diff = Math.max(0, Math.floor((expiryTimestamp - Date.now()) / 1000));
      setTimeLeft(diff);

      if (diff === 0) {
        clearInterval(interval);
        setWaitingForCode(false);
        setLoading(false);
        setErrorBanner("Pairing expired. Try again.");
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [expiryTimestamp]);


  const Content = (
    <>
      <Stack p="xl">
        {errorBanner && (
          <Paper withBorder radius="md" p="sm" bg="red.0" c="red.8" style={{ position: "relative" }}>
            <Stack gap={4} w="100%">
              <Text fw={600}>Pairing error</Text>
              <Text size="sm">{errorBanner}</Text>
            </Stack>
            <Button
              variant="subtle"
              color="red"
              size="compact-xs"
              onClick={() => setErrorBanner(null)}
              style={{ position: "absolute", top: 4, right: 6, paddingInline: 8, height: 34, fontSize: 24 }}
            >
              ×
            </Button>
          </Paper>
        )}
        <Flex
          direction="column"
          align="center"
          justify="center"
          mih={isMobile ? "60vh" : ""}
        >
          <Stepper active={active} size="xl">
            <Stepper.Step icon={<IconEPassport size={32} />}>
              <Center w="100%" mt="md">
                {loading ? (
                  <Stack gap="md" align="center">
                    <StatusLoader>{loadingContent}</StatusLoader>
                    <Button
                      variant="default"
                      onClick={async () => {
                        await cancelCurrentPairing();
                        onClose();
                      }}
                      w="50%"
                    >
                      Cancel
                    </Button>
                  </Stack>
                ) : (

                  <Stack align="center">
                    <Text size="lg" mb="lg" ta="center">
                      Enter the 6-digit code found on the back of your frame.
                    </Text>
                    <PinInput
                      aria-label="Frame code"
                      value={deviceCode}
                      onChange={setDeviceCode}
                      autoFocus
                      length={6}
                      placeholder=""
                      type="number"
                      size="md"
                      gap="md"
                      radius="md"
                    />
                  </Stack>
                )}
              </Center>
            </Stepper.Step>

            <Stepper.Step icon={<IconLink size={32} />}>
              {loading ? (
                <Stack gap="md" align="center">
                  <StatusLoader>{loadingContent}</StatusLoader>
                  <Button
                    variant="default"
                    onClick={async () => {
                      await cancelCurrentPairing();
                      onClose();
                    }}
                    w="50%"
                  >
                    Cancel
                  </Button>
                </Stack>
              ) : (
                <Center w="100%" mt="md">
                  <Stack align="center">
                    <Text size="lg" ta="center" mb="md">
                      A pairing code should appear on your frame. Enter it below.
                    </Text>
                    <PinInput
                      aria-label="Pairing code"
                      disabled={timeLeft <= 0}
                      value={confirmationCode}
                      onChange={setConfirmationCode}
                      autoFocus
                      length={4}
                      placeholder=""
                      type="number"
                      size="md"
                      gap="md"
                      radius="md"
                    />
                    <Button variant="subtle" onClick={async () => {
                      await cancelCurrentPairing();
                      resetWizard();
                    }}>Try again</Button>
                    {attemptsLeft !== null && (
                      <Text size="sm" c="dimmed">
                        {attemptsLeft} attempt{attemptsLeft === 1 ? "" : "s"} remaining
                      </Text>
                    )}
                    {expiryTimestamp && (
                      <Text size="sm" c="dimmed" mt="sm">
                        You have {String(Math.floor(timeLeft / 60)).padStart(2, "0")}:
                        {String(timeLeft % 60).padStart(2, "0")} left to link your frame
                      </Text>
                    )}
                  </Stack>
                </Center>

              )}
            </Stepper.Step>

            <Stepper.Completed>
              <Stack align="center" gap="md" mt="xl">
                <Text size="xl" fw={500}>
                  🎉 Frame successfully linked!
                </Text>
                <Text c="dimmed" ta="center" maw={400}>
                  You can now manage your frame’s settings from the dashboard — change albums, enable collaboration, and more.
                </Text>
                {frameId && (
                  <Button
                    variant="light"
                    component="a"
                    href={`/frame/edit?id=${frameId}`}
                    mt="md"
                  >
                    Go to Frame Settings
                  </Button>
                )}
              </Stack>
            </Stepper.Completed>
          </Stepper>
        </Flex>

        {/* Keep buttons outside Flex so they stay at the bottom */}
        {!loading && (
          <Flex mt="xl" gap="sm">
            {active < 2 ? (
              <>
                <Button
                  variant="default"
                  onClick={async () => {
                    await cancelCurrentPairing();
                    onClose();
                  }}
                  w="50%"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleNext}
                  disabled={!canGoNext()}
                  w="50%"
                >
                  Next
                </Button>
              </>
            ) : (
              <Button
                onClick={onClose}
                w="100%"
              >
                Finish
              </Button>
            )}
          </Flex>
        )}
      </Stack>
    </>
  );


  if (isMobile) {
    return (
      <Drawer
        opened={opened}
        onClose={onClose}
        title="Add New Frame"
        padding="md"
        size="100%"
        zIndex={1000}
        styles={drawerSafeAreaStyles}
      >
        {Content}
      </Drawer>
    )
  }

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      withCloseButton={false}
      radius={"lg"}
      centered
      padding={0}
    >
      {Content}
    </Modal>
  )
}

type FrameAdderContextType = {
  openFrameAdder: () => void;
};

const FrameAdderContext = createContext<FrameAdderContextType | undefined>(undefined);


export function useFrameAdder() {
  const ctx = useContext(FrameAdderContext);
  if (!ctx) throw new Error("useFrameAdder must be used within FrameAdderProvider");
  return ctx;
}

export function FrameAdderProvider({ children }: { children: React.ReactNode }) {
  const [opened, setOpened] = useState(false);

  const openFrameAdder = useCallback(
    () => {
      setOpened(true);
    },
    []
  );

  const handleClose = () => {
    setOpened(false);
  };

  return (
    <FrameAdderContext.Provider value={{ openFrameAdder }}>
      {children}
      <FrameAdder
        opened={opened}
        onClose={handleClose}
      />
    </FrameAdderContext.Provider>
  );
}
