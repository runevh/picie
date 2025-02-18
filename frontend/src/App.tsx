import './App.css'
import { Paper, Flex, MantineProvider } from '@mantine/core';
import '@mantine/core/styles.css';
import '@mantine/carousel/styles.css';
import Login from './components/Login';
import NavBar from './components/NavBar';
import Devices from './components/Devices';

function App() {
  return (
    <MantineProvider defaultColorScheme='dark'>
      <Flex>
        <NavBar/>
        <Paper p={30}>
          <Devices/>
        </Paper>
      </Flex>
    </MantineProvider>
  );
}

export default App
