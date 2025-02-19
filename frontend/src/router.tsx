import { Routes, Route, BrowserRouter as Router, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/UserContext';
import Login from './components/Login';
import Devices from './components/Devices';
import NavBar from './components/NavBar';
import { Paper, Flex } from '@mantine/core';

function AppRouter() {
  const { isAuthenticated } = useAuth();

  return (
    <Router>
      <Routes>
        {/* Public route */}
        <Route path="/login" element={isAuthenticated ? <Navigate to="/" /> : <Login />} />
        
        {/* Protected route */}
        <Route
          path="/"
          element={
            isAuthenticated ? (
              <Flex>
                <NavBar />
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
