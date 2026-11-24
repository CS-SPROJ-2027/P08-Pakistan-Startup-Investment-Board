/**
 * API helper.
 * Sends requests to the backend and returns the JSON response.
 * Throws an ApiError with the server's message if the request fails.
 * The body can be an object (sent as JSON) or FormData (for file uploads).
 */
export class ApiError extends Error {
  data: any;

  constructor(message: string, data: any) {
    super(message);
    this.data = data;
  }
}

export async function apiRequest(url: string, method = 'GET', body?: object | FormData) {
  const isFile = body instanceof FormData;
  const headers: Record<string, string> = {};
  // for FormData the browser sets the content type itself
  if (!isFile) {
    headers['Content-Type'] = 'application/json';
  }

  const token = localStorage.getItem('token');
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(`/api${url}`, {
      method,
      headers,
      body: isFile ? body : body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError('Could not connect to the server. Is it running?', {});
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(data.error || `Request failed with status ${response.status}`, data);
  }
  return data;
}
