export interface User {
  id: string;
  email: string;
  name: string;
  plan: "free" | "creator" | "pro" | "elite";
  createdAt: string;
}

const AUTH_KEY = "lumevo_current_user";
const USERS_KEY = "lumevo_users";

function getUsers(): Record<string, { password: string; user: User }> {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(localStorage.getItem(USERS_KEY) || "{}"); } catch { return {}; }
}

function saveUsers(users: Record<string, { password: string; user: User }>) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

export function getCurrentUser(): User | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function signup(name: string, email: string, password: string): { user: User } | { error: string } {
  const users = getUsers();
  const key = email.toLowerCase().trim();
  if (users[key]) return { error: "An account with this email already exists." };
  if (password.length < 6) return { error: "Password must be at least 6 characters." };
  if (!name.trim()) return { error: "Please enter your name." };

  const user: User = {
    id: Math.random().toString(36).slice(2) + Date.now().toString(36),
    email: key,
    name: name.trim(),
    plan: "free",
    createdAt: new Date().toISOString(),
  };
  users[key] = { password, user };
  saveUsers(users);
  localStorage.setItem(AUTH_KEY, JSON.stringify(user));
  return { user };
}

export function login(email: string, password: string): { user: User } | { error: string } {
  const users = getUsers();
  const key = email.toLowerCase().trim();
  const record = users[key];
  if (!record) return { error: "No account found with this email." };
  if (record.password !== password) return { error: "Incorrect password." };
  localStorage.setItem(AUTH_KEY, JSON.stringify(record.user));
  return { user: record.user };
}

export function logout() {
  if (typeof window !== "undefined") localStorage.removeItem(AUTH_KEY);
}

export function updateUserPlan(plan: User["plan"]) {
  const user = getCurrentUser();
  if (!user) return;
  const updated = { ...user, plan };
  const users = getUsers();
  const key = user.email;
  if (users[key]) users[key].user = updated;
  saveUsers(users);
  localStorage.setItem(AUTH_KEY, JSON.stringify(updated));
}
