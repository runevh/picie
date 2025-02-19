import './App.css'
import { MantineProvider } from '@mantine/core';
import '@mantine/core/styles.css';
import '@mantine/carousel/styles.css';
import { AuthProvider } from './contexts/UserContext';
import AppRouter from './router';

function App() {
  return (
    <MantineProvider defaultColorScheme='dark'>
      <AuthProvider>
        <AppRouter></AppRouter>
      </AuthProvider>
    </MantineProvider>
  );
}

export default App
