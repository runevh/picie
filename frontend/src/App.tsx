import './App.css'
import { MantineProvider } from '@mantine/core';
import '@mantine/core/styles.css';
import '@mantine/carousel/styles.css';
import { AuthProvider } from './contexts/UserContext';
import { DeviceProvider } from './contexts/DeviceContext';
import { PhotoProvider } from './contexts/PhotoContext';
import { AppRouter, testRoutes } from './components/router/AppRouter';
import { BrowserRouter } from 'react-router-dom';
import { AlbumEditorProvider } from './components/photos/AlbumEditor';

function App() {
  return (
    <MantineProvider defaultColorScheme='light'>
      <BrowserRouter>
        <AuthProvider>
          <AlbumEditorProvider>
            <AppRouter routes={testRoutes}></AppRouter>
          </AlbumEditorProvider>
        </AuthProvider>
      </BrowserRouter>
    </MantineProvider>
  );
}

export default App
