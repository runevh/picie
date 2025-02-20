import './App.css'
import { MantineProvider } from '@mantine/core';
import '@mantine/core/styles.css';
import '@mantine/carousel/styles.css';
import { AuthProvider } from './contexts/UserContext';
import AppRouter from './router';
import { DeviceProvider } from './contexts/DeviceContext';

function App() {
  return (
    <MantineProvider defaultColorScheme='dark'>
      <AuthProvider>
        <DeviceProvider>
          <AppRouter></AppRouter>
        </DeviceProvider>
      </AuthProvider>
    </MantineProvider>
  );
}

export default App
