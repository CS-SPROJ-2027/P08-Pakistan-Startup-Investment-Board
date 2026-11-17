/**
 * Only shows the page if the user is logged in and has one of the allowed roles.
 * Otherwise sends them to the login page.
 */
import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { User } from '../types';

interface Props {
  user: User | null;
  roles?: string[];
  children: ReactNode;
}

function ProtectedRoute({ user, roles, children }: Props) {
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
}

export default ProtectedRoute;
