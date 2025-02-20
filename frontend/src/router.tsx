import { Routes, Route, BrowserRouter as Router, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/UserContext';
import Login from './components/Login';
import Devices from './components/Devices';
import NavBar from './components/NavBar';
import { Paper, Flex } from '@mantine/core';
import Admin from './components/admin/Admin';

function AppRouter() {
  const { isAuthenticated } = useAuth();
  return (
    <Router>
      <Routes>
        {/* Public route */}
        <Route path="/login" element={isAuthenticated ? <Navigate to="/devices" /> : <Login />} />
        
        {/* Protected routes */}

        {/* Admin */}
        <Route
          path="/admin"
          element={
            isAuthenticated ? (
              <Flex>
                <NavBar active={4}/>
                <Paper p={30}>
                  <Admin />
                </Paper>
              </Flex>
            ) : (
              <Navigate to="/login" />
            )
          }
        />

        {/* Devices */}
        <Route
          path="/devices"
          element={
            isAuthenticated ? (
              <Flex>
                <NavBar active={2}/>
                <Paper p={30}>
                  <Devices />
                </Paper>
              </Flex>
            ) : (
              <Navigate to="/login" />
            )
          }
        />
      </Routes>
    </Router>
  );
}

export default AppRouter;
