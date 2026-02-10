import './App.css'
import { MantineProvider } from '@mantine/core';
import '@mantine/core/styles.css';
import '@mantine/dates/styles.css';
import '@mantine/carousel/styles.css';
import '@mantine/notifications/styles.css';
import { Notifications } from '@mantine/notifications';
import { AuthProvider } from './contexts/UserContext';
import { DeviceProvider } from './contexts/DeviceContext';
import { AppRouter, testRoutes } from './components/router/AppRouter';
import { BrowserRouter } from 'react-router-dom';
import { AlbumEditorProvider } from './components/photos/AlbumEditor';
import { FrameAdderProvider } from './components/frames/FrameAdder';
import { PhotoUploaderProvider } from './components/photos/PhotoUploader';
import { PhotoProvider } from './contexts/PhotoContext';

function App() {
  return (
    <MantineProvider
      defaultColorScheme="dark"
      forceColorScheme="dark"
      withCssVariables
      theme={{
        primaryShade: { light: 6, dark: 5 },
      }}
    >
      <Notifications position="top-right" />
      <BrowserRouter>
        <AuthProvider>
          <PhotoProvider>
            <PhotoUploaderProvider>
              <AlbumEditorProvider>
                <DeviceProvider>
                  <FrameAdderProvider>
                    <AppRouter routes={testRoutes}></AppRouter>
                  </FrameAdderProvider>
                </DeviceProvider>
              </AlbumEditorProvider>
            </PhotoUploaderProvider>
          </PhotoProvider>
        </AuthProvider> 
      </BrowserRouter>
    </MantineProvider >
  );
}

export default App
