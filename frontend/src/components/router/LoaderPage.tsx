import { Center, Loader } from "@mantine/core";
import { Background } from "../layout/Background";

export function LoaderPage() {
  return (
    <Background fullHeight>
      <Center h="100vh" w="100vw">
        <Loader size="lg" />
      </Center>
    </Background>
  );
}
