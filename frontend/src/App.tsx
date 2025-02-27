import './App.css'
import { MantineProvider } from '@mantine/core';
import '@mantine/core/styles.css';
import '@mantine/carousel/styles.css';
import { AuthProvider } from './contexts/UserContext';
import AppRouter from './router';
import { DeviceProvider } from './contexts/DeviceContext';
import { PhotoProvider } from './contexts/PhotoContext';

function App() {
  return (
    <MantineProvider defaultColorScheme='dark'>
      <AuthProvider>
        <DeviceProvider>
          <PhotoProvider>
            <AppRouter></AppRouter>
          </PhotoProvider>
        </DeviceProvider>
      </AuthProvider>
    </MantineProvider>
  );
}

export default App
