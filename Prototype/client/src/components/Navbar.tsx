/**
 * Top navigation bar shown on every page.
 * Shows different links depending on whether the user is logged in and their role.
 */
import { Link } from 'react-router-dom';
import { User } from '../types';

interface Props {
  user: User | null;
  onLogout: () => void;
}

function Navbar({ user, onLogout }: Props) {
  return (
    <nav className="navbar">
      <Link to="/" className="brand">PSIB</Link>
      {user ? (
        <>
          <Link to="/dashboard">Dashboard</Link>
          {user.role === 'founder' && <Link to="/profile">My Profile</Link>}
          {user.role === 'admin' && <Link to="/admin/users">Approve Accounts</Link>}
          <span className="nav-user">{user.fullName} ({user.role})</span>
          <button className="nav-button" onClick={onLogout}>Logout</button>
        </>
      ) : (
        <>
          <Link to="/login">Login</Link>
          <Link to="/register">Register</Link>
        </>
      )}
    </nav>
  );
}

export default Navbar;
