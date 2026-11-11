/**
 * Helpers for saving and reading the logged in user in the browser.
 */
export function saveLogin(token, user) {
  localStorage.setItem('token', token);
  localStorage.setItem('user', JSON.stringify(user));
}

export function getSavedUser() {
  const user = localStorage.getItem('user');
  return user ? JSON.parse(user) : null;
}

export function clearLogin() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
}
