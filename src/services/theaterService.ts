import { Theater } from "../types";

const API_BASE = "/api";

// ── Public ─────────────────────────────────────────────────────────────────

export async function getTheatersFromMap(): Promise<Theater[]> {
  try {
    const res = await fetch(`${API_BASE}/theaters.php`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (error) {
    console.error("Error fetching theaters:", error);
    return [];
  }
}

// ── Admin (requires active session) ────────────────────────────────────────

export async function addTheater(data: Omit<Theater, "id">): Promise<Theater> {
  const res = await fetch(`${API_BASE}/theaters.php`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }
  return res.json();
}

export async function updateTheater(
  id: string,
  data: Partial<Theater>
): Promise<void> {
  const res = await fetch(`${API_BASE}/theaters.php?id=${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }
}

export async function deleteTheater(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/theaters.php?id=${id}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }
}

// ── Auth ────────────────────────────────────────────────────────────────────

export interface AuthState {
  loggedIn: boolean;
  email: string;
}

export async function checkSession(): Promise<AuthState> {
  try {
    const res = await fetch(`${API_BASE}/auth.php`, {
      credentials: "include",
    });
    if (!res.ok) return { loggedIn: false, email: "" };
    return res.json();
  } catch {
    return { loggedIn: false, email: "" };
  }
}

export async function loginAdmin(
  email: string,
  password: string
): Promise<AuthState> {
  const res = await fetch(`${API_BASE}/auth.php`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ action: "login", email, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? "Login failed");
  }
  return res.json();
}

export async function logoutAdmin(): Promise<void> {
  await fetch(`${API_BASE}/auth.php`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ action: "logout" }),
  });
}
