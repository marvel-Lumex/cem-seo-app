import AsyncStorage from "@react-native-async-storage/async-storage";

// ⚠️ Update this before running on a physical device — "localhost" only
// works in the iOS Simulator. Use your computer's LAN IP for real devices,
// e.g. "http://192.168.1.42:4000", or a tunneling service like ngrok.
export const API_BASE_URL = "http://localhost:4000";

const TOKEN_KEY = "cemseo_token";

export async function getToken(): Promise<string | null> {
  return AsyncStorage.getItem(TOKEN_KEY);
}

export async function setToken(token: string): Promise<void> {
  await AsyncStorage.setItem(TOKEN_KEY, token);
}

export async function clearToken(): Promise<void> {
  await AsyncStorage.removeItem(TOKEN_KEY);
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  auth = true
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (auth) {
    const token = await getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || `Request failed with status ${res.status}`);
  }
  return data as T;
}

export const api = {
  signup: (name: string, email: string, password: string) =>
    request<{ token: string; user: { id: number; name: string; email: string } }>(
      "/api/auth/signup",
      { method: "POST", body: JSON.stringify({ name, email, password }) },
      false
    ),
  login: (email: string, password: string) =>
    request<{ token: string; user: { id: number; name: string; email: string } }>(
      "/api/auth/login",
      { method: "POST", body: JSON.stringify({ email, password }) },
      false
    ),
  getGscStatus: () =>
    request<{ configured: boolean; connected: boolean; siteUrl: string | null }>("/api/gsc/status"),
  getGscAuthUrl: () => request<{ url: string }>("/api/gsc/auth-url"),
  getGscSites: () => request<{ siteUrl: string; permissionLevel: string }[]>("/api/gsc/sites"),
  setGscSite: (siteUrl: string) =>
    request<{ siteUrl: string }>("/api/gsc/site", { method: "PUT", body: JSON.stringify({ siteUrl }) }),
  disconnectGsc: () => request<{ disconnected: boolean }>("/api/gsc/disconnect", { method: "DELETE" }),
  verifyEmail: (code: string) =>
    request<{ verified: boolean }>("/api/auth/verify", { method: "POST", body: JSON.stringify({ code }) }),
  resendCode: () => request<{ sent: boolean }>("/api/auth/resend-code", { method: "POST" }),
  updateProfile: (name: string) =>
    request<{ user: { id: number; name: string; email: string; emailVerified: boolean } }>(
      "/api/auth/profile",
      { method: "PUT", body: JSON.stringify({ name }) }
    ),
  getNotificationPrefs: () =>
    request<{ emailNotifications: boolean; pushNotifications: boolean; weeklyReport: boolean }>(
      "/api/auth/notification-prefs"
    ),
  updateNotificationPrefs: (prefs: { emailNotifications: boolean; pushNotifications: boolean; weeklyReport: boolean }) =>
    request<{ emailNotifications: boolean; pushNotifications: boolean; weeklyReport: boolean }>(
      "/api/auth/notification-prefs",
      { method: "PUT", body: JSON.stringify(prefs) }
    ),
  getDashboard: () =>
    request<{
      domain: string;
      seoScore: number;
      totalClicks: number;
      totalImpressions: number;
      avgPosition: number;
      backlinks: number;
      lastAuditAt: string;
      isLiveData: boolean;
    }>("/api/dashboard"),
  getProjects: () =>
    request<
      { id: number; domain: string; status: string; seoScore: number; lastAuditAt: string; isActive: boolean }[]
    >("/api/projects"),
  createProject: (domain: string) =>
    request<{ id: number; domain: string; status: string; seoScore: number }>("/api/projects", {
      method: "POST",
      body: JSON.stringify({ domain }),
    }),
  setActiveProject: (id: number) =>
    request<{ activeProjectId: number; domain: string }>(`/api/projects/${id}/activate`, { method: "PUT" }),
  deleteProject: (id: number) =>
    request<{ deleted: boolean }>(`/api/projects/${id}`, { method: "DELETE" }),
  getProject: (id: number) =>
    request<{
      id: number;
      domain: string;
      status: string;
      seoScore: number;
      totalClicks: number;
      totalImpressions: number;
      avgPosition: number;
      backlinks: number;
      lastAuditAt: string;
      isActive: boolean;
      latestAudit: { healthScore: number; criticalIssues: number; warnings: number; notices: number; passedChecks: number } | null;
    }>(`/api/projects/${id}`),
  getAuditHistory: () =>
    request<{ healthScore: number; runAt: string }[]>("/api/audit/history"),
  getAudit: () =>
    request<{
      healthScore: number;
      criticalIssues: number;
      warnings: number;
      notices: number;
      passedChecks: number;
      topIssues: { title: string; score: number }[];
      categoryScores: { performance: number | null; accessibility: number | null; bestPractices: number | null; seo: number | null } | null;
      runAt: string;
    }>("/api/audit"),
  runAudit: () =>
    request<{
      healthScore: number;
      criticalIssues: number;
      warnings: number;
      notices: number;
      passedChecks: number;
      topIssues: { title: string; score: number }[];
      categoryScores: { performance: number | null; accessibility: number | null; bestPractices: number | null; seo: number | null } | null;
      runAt: string;
    }>("/api/audit/run", { method: "POST" }),
  getKeywords: (q?: string) =>
    request<{ keyword: string; volume: string; difficulty: number }[]>(
      `/api/keywords${q ? `?q=${encodeURIComponent(q)}` : ""}`
    ),
  getKeywordTrends: (keyword: string) =>
    request<{
      keyword: string;
      interestOverTime: { date: string; value: number }[];
      relatedQueries: { top: string[]; rising: string[] };
    }>(`/api/keywords/trends?keyword=${encodeURIComponent(keyword)}`),
};
