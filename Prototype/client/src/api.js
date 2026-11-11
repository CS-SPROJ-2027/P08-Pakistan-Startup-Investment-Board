/**
 * API helper.
 * Sends requests to the backend and returns the JSON response.
 * Throws an Error with the server's message if the request fails.
 */
export async function apiRequest(url, method = 'GET', body) {
  const options = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };

  const token = localStorage.getItem('token');
  if (token) {
    options.headers.Authorization = `Bearer ${token}`;
  }
  if (body) {
    options.body = JSON.stringify(body);
  }

  let response;
  try {
    response = await fetch(`/api${url}`, options);
  } catch {
    throw new Error('Could not connect to the server. Is it running?');
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `Request failed with status ${response.status}`);
  }
  return data;
}
