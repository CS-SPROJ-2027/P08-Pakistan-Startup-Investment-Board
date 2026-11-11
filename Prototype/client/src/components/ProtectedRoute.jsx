/**
 * Only shows the page if the user is logged in and has one of the allowed roles.
 * Otherwise sends them to the login page.
 */
import { Navigate } from 'react-router-dom';

function ProtectedRoute({ user, roles, children }) {
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
}

export default ProtectedRoute;
