export function getAuthToken() {
  return null;
}

export function getAuthUser() {
  const raw = localStorage.getItem("user");
  return raw ? JSON.parse(raw) : null;
}

export function saveAuthSession(user: unknown) {
  localStorage.setItem("user", JSON.stringify(user));
}

export function setAuthUser(user: unknown) {
  localStorage.setItem("user", JSON.stringify(user));
}

export function clearAuthSession() {
  localStorage.removeItem("user");
}

export async function logoutSession() {
  try {
    await fetch("/api/v1/auth/logout", {
      method: "POST",
      credentials: "include",
    });
  } finally {
    clearAuthSession();
  }
}

export async function apiFetch<T>(input: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers || {});

  if (!headers.has("Content-Type") && init.body && !(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(input, {
    ...init,
    headers,
    credentials: "include",
  });

  if (!response.ok) {
    let message = "Request failed";
    try {
      const data = await response.json();
      message = data.error || data.message || message;
    } catch {
      // ignore
    }

    if (response.status === 401) {
      clearAuthSession();
    }

    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}
