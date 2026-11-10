import type { Family, Transaction, Trip, TripCategory, TripUser } from "./data";

const apiBase = (import.meta.env.VITE_POCKET_API_URL ?? "https://sunshineproduct.in/trip/v1_api").replace(/\/+$/, "");
const appBase = (import.meta.env.BASE_URL ?? "/").replace(/\/+$/, "");
export const appPath = (path: string) => `${appBase}${path.startsWith("/") ? path : `/${path}`}` || "/";

type ApiEnvelope<T> = { status?: string; message?: string; token?: string; user?: Record<string, unknown>; data?: T; trip_id?: string | number; family_id?: string | number; user_id?: string | number; category_id?: string | number };
type LiveNotification = { id: string; text: string; time: string; unread: boolean };
export type LiveLedger = {
  families: Family[];
  users: TripUser[];
  trips: Trip[];
  tripUsers: Record<string, string[]>;
  transactions: Transaction[];
  categories: TripCategory[];
  notifications: LiveNotification[];
};

export async function apiPost<T>(endpoint: string, payload: Record<string, unknown>, token?: string): Promise<ApiEnvelope<T>> {
  let response: Response;
  try {
    response = await fetch(`${apiBase}/${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new Error("Can't reach the trip API. Check your internet connection and try again.");
  }
  const text = await response.text();
  let result: ApiEnvelope<T>;
  try {
    result = JSON.parse(text) as ApiEnvelope<T>;
  } catch {
    const detail = text.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 180);
    throw new Error(detail || `Trip API returned an unreadable response (HTTP ${response.status}).`);
  }
  if (!response.ok || result.status !== "success") {
    throw new Error(result.message || `Trip API request failed (HTTP ${response.status}).`);
  }
  return result;
}

export async function signIn(mobile: string, password: string) {
  const result = await apiPost<never>("auth.php", { type: 5, mobile: mobile.replace(/\D/g, ""), password });
  if (!result.token || !result.user) throw new Error("The API accepted the request but returned no session. Please contact support.");
  const account = result.user;
  return {
    token: result.token,
    user: {
      id: String(account.user_id ?? account.id ?? mobile),
      name: String(account.full_name ?? account.name ?? ""),
      mobile: String(account.mobile ?? mobile),
      email: String(account.email ?? ""),
      familyId: String(account.family_id ?? account.familyId ?? ""),
    } satisfies TripUser,
  };
}

export async function validateSession(token: string) {
  const result = await apiPost<never>("auth.php", { type: 3 }, token);
  if (!result.user) throw new Error("Your session is no longer valid. Please sign in again.");
  const account = result.user;
  return {
    id: String(account.user_id ?? account.id ?? ""),
    name: String(account.full_name ?? account.name ?? ""),
    mobile: String(account.mobile ?? ""),
    email: String(account.email ?? ""),
    familyId: String(account.family_id ?? account.familyId ?? ""),
  } satisfies TripUser;
}

export async function loadLiveLedger(token: string): Promise<LiveLedger> {
  const [familyResponse, userResponse, tripResponse, notificationResponse] = await Promise.all([
    apiPost<Record<string, unknown>[]>("family.php", { type: 1 }, token),
    apiPost<Record<string, unknown>[]>("user.php", { type: 1 }, token),
    apiPost<Record<string, unknown>[]>("trip.php", { type: 1 }, token),
    apiPost<Record<string, unknown>[]>("notification.php", { type: 1 }, token),
  ]);
  const families: Family[] = (familyResponse.data ?? []).map((family) => ({ id: String(family.id), name: String(family.name ?? ""), headUserId: String(family.headUserId ?? "") }));
  const users: TripUser[] = (userResponse.data ?? []).map((user) => ({ id: String(user.id), name: String(user.name ?? ""), mobile: String(user.mobile ?? ""), email: String(user.email ?? ""), familyId: String(user.familyId ?? "") }));
  const trips: Trip[] = (tripResponse.data ?? []).map((trip) => ({
    id: String(trip.id), name: String(trip.name ?? ""), date: String(trip.date ?? ""),
    ...(trip.endDate ? { endDate: String(trip.endDate) } : {}), adminUserId: String(trip.adminUserId ?? ""),
    familyIds: Array.isArray(trip.familyIds) ? trip.familyIds.map(String) : [],
    adminUserIds: Array.isArray(trip.adminUserIds) ? trip.adminUserIds.map(String) : [String(trip.adminUserId ?? "")],
  }));
  const tripUsers: Record<string, string[]> = {};
  for (const rawTrip of tripResponse.data ?? []) tripUsers[String(rawTrip.id)] = Array.isArray(rawTrip.memberIds) ? rawTrip.memberIds.map(String) : [];

  const tripDetails = await Promise.all(trips.map(async (trip) => {
    const [categoryResponse, expenseResponse] = await Promise.all([
      apiPost<Record<string, unknown>[]>("category.php", { type: 1, trip_id: trip.id }, token),
      apiPost<Record<string, unknown>[]>("expense.php", { type: 1, trip_id: trip.id }, token),
    ]);
    const categories: TripCategory[] = (categoryResponse.data ?? []).map((category) => ({ id: String(category.id), name: String(category.name ?? "") }));
    const transactions: Transaction[] = (expenseResponse.data ?? []).map((expense) => ({
      id: String(expense.id), tripId: String(expense.tripId ?? trip.id), title: String(expense.title ?? ""),
      categoryId: String(expense.categoryId ?? ""), amount: Number(expense.amount ?? 0),
      paidByUserId: String(expense.paidByUserId ?? ""), date: String(expense.date ?? ""),
      remark: String(expense.remark ?? ""), updated: Boolean(Number(expense.updated ?? 0)),
      splits: Array.isArray(expense.splits) ? expense.splits.map((split) => ({ userId: String((split as Record<string, unknown>).userId), shareAmount: Number((split as Record<string, unknown>).shareAmount ?? 0) })) : [],
    }));
    return { categories, transactions };
  }));
  const notifications: LiveNotification[] = (notificationResponse.data ?? []).map((item) => ({
    id: String(item.id), text: String(item.text ?? ""), time: String(item.createdAt ?? ""), unread: Boolean(item.unread),
  }));
  return {
    families, users, trips, tripUsers,
    categories: [...new Map(tripDetails.flatMap((trip) => trip.categories).map((category) => [category.id, category])).values()],
    transactions: tripDetails.flatMap((trip) => trip.transactions), notifications,
  };
}
