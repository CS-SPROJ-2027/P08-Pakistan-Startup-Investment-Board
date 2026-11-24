/**
 * Main app component.
 * Keeps track of the logged in user and sets up the page routes.
 * New pages are added here for each use case.
 */
import { useState } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';
import Home from './pages/Home';
import Register from './pages/Register';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import AdminUsers from './pages/AdminUsers';
import StartupProfile from './pages/StartupProfile';
import AccessSettings from './pages/AccessSettings';
import SharedStartups from './pages/SharedStartups';
import StartupDetails from './pages/StartupDetails';
import NotFound from './pages/NotFound';
import { getSavedUser, clearLogin } from './auth';
import { User } from './types';

function App() {
  const [user, setUser] = useState<User | null>(getSavedUser());
  const navigate = useNavigate();

  function handleLogout() {
    clearLogin();
    setUser(null);
    navigate('/login');
  }

  return (
    <>
      <Navbar user={user} onLogout={handleLogout} />
      <main className="container">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/register" element={<Register />} />
          <Route path="/login" element={<Login onLogin={setUser} />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute user={user}>
                <Dashboard user={user as User} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/users"
            element={
              <ProtectedRoute user={user} roles={['admin']}>
                <AdminUsers />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute user={user} roles={['founder']}>
                <StartupProfile />
              </ProtectedRoute>
            }
          />
          <Route
            path="/access"
            element={
              <ProtectedRoute user={user} roles={['founder']}>
                <AccessSettings />
              </ProtectedRoute>
            }
          />
          <Route
            path="/startups"
            element={
              <ProtectedRoute user={user} roles={['investor', 'incubator']}>
                <SharedStartups />
              </ProtectedRoute>
            }
          />
          <Route
            path="/startups/:id"
            element={
              <ProtectedRoute user={user} roles={['investor', 'incubator']}>
                <StartupDetails />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
    </>
  );
}

export default App;
