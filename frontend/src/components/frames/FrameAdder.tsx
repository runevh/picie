import { createContext, ReactElement, useCallback, useContext, useEffect, useState } from "react";
import { useIsMobile } from "../../util/LayoutUtil";
import {
  Modal,
  Drawer,
  Button,
  TextInput,
  Group,
  Stack,
  Text,
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

type FrameAdderProps = {
  opened: boolean;
  onClose: () => void;
};

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


  const isMobile = useIsMobile();
  const { startPairing } = useDeviceContext();

  const canGoNext = () => {
    if (active === 0) {
      return /^\d{6}$/.test(deviceCode); // exactly 6 digits
    }
    if (active === 1) {
      return confirmationCode.trim().length > 0;
    }
    // Add other step validations here if needed
    return true;
  };

  const handleNext = async () => {
    if (!canGoNext()) {
      if (active === 0) setDeviceCodeError("Please enter a valid 6-digit code");
      if (active === 1) setConfirmationCodeError("Confirmation code cannot be empty");
      return;
    }

    if (active === 0) {
      setLoading(true);
      // After step 1, show loading before moving to step 2
      setLoadingContent(<>Fetching device info...</>);

      const res = await startPairing(deviceCode);
      setLoading(false);
      if (res.success) {
        setActive((current) => current + 1);
      } else {
        console.log(res.data);
        setDeviceCodeError(res.data);
      }
      /*setLoadingContent(<>Preparing device...</>);
      setTimeout(() => {
        setLoading(false);
        setActive((current) => current + 1); // go to step 2 after loading
      }, 1000);
    }, 1000);*/


      setDeviceCodeError(null);
      setConfirmationCodeError(null);
    };

    if (active === 1) {
      // Simulate API call to complete pairing
      setLoading(true);
      setLoadingContent(<>Finishing pairing...</>);
      setTimeout(() => {
        setLoading(false);
        setFrameId("1234abc"); // replace with real frame ID if available
        setActive((current) => current + 1); // move to Completed
      }, 1000);
    }


  }

  useEffect(() => {
    if (loading && !expiryTimestamp) {
      const expiration = Date.now() + 60 * 15_000; // 60 seconds from now
      setExpiryTimestamp(expiration);
    }
  }, [loading, expiryTimestamp]);

  // Update countdown every second
  useEffect(() => {
    if (!expiryTimestamp) return;

    const interval = setInterval(() => {
      const diff = Math.max(0, Math.floor((expiryTimestamp - Date.now()) / 1000));
      setTimeLeft(diff);

      if (diff === 0) clearInterval(interval);
    }, 1000);

    return () => clearInterval(interval);
  }, [expiryTimestamp]);


  const Content = (
    <>
      <Stack p="xl">
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
                  <StatusLoader>{loadingContent}</StatusLoader>
                ) : (

                  <Stack align="center">
                    <Text size="lg" mb="lg" ta="center">
                      Enter the 6-digit code found on the back of your frame.
                    </Text>
                    <PinInput
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
                <StatusLoader>{loadingContent}</StatusLoader>
              ) : (
                <Center w="100%" mt="md">
                  <Stack align="center">
                    <Text size="lg" ta="center" mb="md">
                      A pairing code should appear on your frame. Enter it below.
                    </Text>
                    <PinInput
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
        <Flex mt="xl" gap="sm">
          <Button
            variant="default"
            onClick={onClose}
            w="50%"
          >
            Cancel
          </Button>
          <Button
            onClick={handleNext}
            disabled={!canGoNext()}
            w="50%"
          >
            {active === 2 ? "Finish" : "Next"}
          </Button>
        </Flex>
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
