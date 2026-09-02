// CampusFix — shared API helper (frontend)
//
// Temporary auth note: Login/Register UI isn't built yet, so for now the
// JWT is read straight out of localStorage under the key below. Set it
// once from your browser console after logging in via curl/Postman:
//
//   localStorage.setItem("campusfix_token", "PASTE_YOUR_TOKEN_HERE")
//
// Once the real Login page exists, that page should call setToken() on
// successful login instead of this manual step.

export const API_BASE = "http://localhost:4000"; // confirm this matches Aradhya's backend/.env PORT
const TOKEN_KEY = "campusfix_token";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

/**
 * Thin fetch wrapper: adds the base URL, JSON headers, and the auth token
 * (when present). Throws an Error with a `.status` property on non-2xx
 * responses so callers can branch on err.status === 403, etc.
 */
export async function apiFetch(path, options = {}) {
  const token = getToken();

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.message) message = body.message;
    } catch {
      // response wasn't JSON — keep the generic message
    }
    const error = new Error(message);
    error.status = res.status;
    throw error;
  }

  if (res.status === 204) return null;
  return res.json();
}
