/**
 * Helpers for saving and reading the logged in user in the browser.
 */
import { User } from './types';

export function saveLogin(token: string, user: User) {
  localStorage.setItem('token', token);
  localStorage.setItem('user', JSON.stringify(user));
}

export function getSavedUser(): User | null {
  const user = localStorage.getItem('user');
  return user ? JSON.parse(user) : null;
}

export function clearLogin() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
}
