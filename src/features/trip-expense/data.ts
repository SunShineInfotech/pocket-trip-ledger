import type { SettlementExpense } from "@/lib/settlement";

export type Family = { id: string; name: string; headUserId: string };
export type TripUser = {
  id: string;
  name: string;
  mobile: string;
  email: string;
  familyId: string;
};
export type Trip = {
  id: string;
  name: string;
  date: string;
  endDate?: string;
  adminUserId: string;
  adminUserIds?: string[];
  familyIds: string[];
};
export type TripCategory = { id: string; name: string };
export type Transaction = SettlementExpense & {
  id: string;
  tripId: string;
  title: string;
  categoryId: string;
  remark?: string;
  updated?: boolean;
};

export const formatRupees = (amount: number, compact = false) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
    notation: compact ? "compact" : "standard",
  }).format(amount);

export const formatDate = (date: string) =>
  new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" }).format(
    new Date(`${date}T00:00:00`),
  );

export const initials = (name: string) =>
  name.split(/\s+/).slice(0, 2).map((part) => part[0] ?? "").join("").toUpperCase();
