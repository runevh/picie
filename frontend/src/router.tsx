import { Routes, Route, BrowserRouter as Router, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/UserContext';
import Login from './components/Login';
import Devices from './components/Devices';
import NavBar from './components/NavBar';
import Admin from './components/admin/Admin';
import Images from './components/Images';
import Home from './components/Home';
import { IconHome2, IconLibraryPhoto, IconPhotoScan, IconShieldLock } from '@tabler/icons-react';

interface Page {
  label: string,
  url: string,
  icon: typeof IconHome2,
  page: any,
}

function AppRouter() {
  const { isAuthenticated } = useAuth();

  const pages: Page[] = [
    {label: 'Home', url: '', icon: IconHome2, page: <Home></Home>},
    {label: 'Photo Collages', url: 'photos', icon: IconLibraryPhoto, page: <Images></Images>},
    {label: 'Devices', url: 'devices', icon: IconPhotoScan, page: <Devices></Devices>},
  ];

  if (isAuthenticated) {
    pages.push({label: 'Admin', url: '/admin', icon: IconShieldLock, page: <Admin></Admin>});
  }

  return (
    <Router>
      <Routes>
        <Route path='/login' element={isAuthenticated ? <Navigate to="/" /> : <Login></Login>}/>

        {pages.map((page, index) => (
          <Route
          key={index}
          path={page.url}
          element=
          {!isAuthenticated ? 
            <Navigate to="/login" /> : 
            <NavBar activePage={page.url} pages={pages}></NavBar>}
        />
        ))}

        <Route
          path='*' 
          element=
          {!isAuthenticated ? 
            <Navigate to="/login" /> : 
            <NavBar activePage='' pages={pages}></NavBar>}
        />
      </Routes>
    </Router>
  )
}

export default AppRouter;
