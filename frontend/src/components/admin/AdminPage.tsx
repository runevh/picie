import { Button } from '@mantine/core';
import { useDeviceContext } from '../../contexts/DeviceContext';
import { postRequest } from '../../services/api';

export function AdminPage() {
  const { createDevice } = useDeviceContext();

  const handleCreateDevice = async () => {
    try {
      const response = await createDevice();
      console.log('Device created:', response);
      // Optionally update state or show notifications here
    } catch (error) {
      console.error('Failed to create device:', error);
    }
  };

  const handleUpdateImage = async () => {
    await postRequest("device/set", {});
  };

  return (
    <>
      <Button onClick={handleCreateDevice}>Create Device</Button>
      <Button onClick={handleUpdateImage}>set</Button>
    </>
  );
}
