import { splitAmount, type SettlementExpense } from "@/lib/settlement";

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

export const families: Family[] = [
  { id: "fam-sharma", name: "Sharma family", headUserId: "user-raj" },
  { id: "fam-iyer", name: "Iyer family", headUserId: "user-arjun" },
  { id: "fam-mehta", name: "Mehta family", headUserId: "user-kavita" },
  { id: "fam-kapoor", name: "Kapoor family", headUserId: "user-dev" },
];

export const users: TripUser[] = [
  { id: "user-raj", name: "Raj Sharma", mobile: "9876543210", email: "raj@example.com", familyId: "fam-sharma" },
  { id: "user-neha", name: "Neha Sharma", mobile: "9876543211", email: "neha@example.com", familyId: "fam-sharma" },
  { id: "user-aman", name: "Aman Sharma", mobile: "9876543212", email: "aman@example.com", familyId: "fam-sharma" },
  { id: "user-tara", name: "Tara Sharma", mobile: "9876543213", email: "tara@example.com", familyId: "fam-sharma" },
  { id: "user-arjun", name: "Arjun Iyer", mobile: "9876543220", email: "arjun@example.com", familyId: "fam-iyer" },
  { id: "user-priya", name: "Priya Iyer", mobile: "9876543221", email: "priya@example.com", familyId: "fam-iyer" },
  { id: "user-rohan", name: "Rohan Iyer", mobile: "9876543222", email: "rohan@example.com", familyId: "fam-iyer" },
  { id: "user-maya", name: "Maya Iyer", mobile: "9876543223", email: "maya@example.com", familyId: "fam-iyer" },
  { id: "user-kavita", name: "Kavita Mehta", mobile: "9876543230", email: "kavita@example.com", familyId: "fam-mehta" },
  { id: "user-nikhil", name: "Nikhil Mehta", mobile: "9876543231", email: "nikhil@example.com", familyId: "fam-mehta" },
  { id: "user-isha", name: "Isha Mehta", mobile: "9876543232", email: "isha@example.com", familyId: "fam-mehta" },
  { id: "user-dev", name: "Dev Kapoor", mobile: "9876543240", email: "dev@example.com", familyId: "fam-kapoor" },
];

export const trips: Trip[] = [
  {
    id: "trip-coorg",
    name: "Coorg family escape",
    date: "2026-11-06",
    endDate: "2026-11-11",
    adminUserId: "user-raj",
    familyIds: families.map((family) => family.id),
  },
];

export const tripUsers: Record<string, string[]> = {
  "trip-coorg": users.map((user) => user.id),
};

export const categories: TripCategory[] = [
  { id: "food", name: "Food & dining" },
  { id: "travel", name: "Travel" },
  { id: "stay", name: "Stay" },
  { id: "tickets", name: "Activities" },
  { id: "fuel", name: "Fuel" },
  { id: "shopping", name: "Shopping" },
];

const allUserIds = users.map((user) => user.id);
const groupOne = allUserIds.slice(0, 8);
const groupTwo = allUserIds.slice(4);
const groupThree = allUserIds.slice(0, 4).concat(allUserIds.slice(8));
const groupFour = allUserIds.slice(2, 10);

const seedExpense = (
  id: string,
  title: string,
  categoryId: string,
  amount: number,
  paidByUserId: string,
  date: string,
  memberIds: string[],
  remark?: string,
): Transaction => ({
  id,
  tripId: "trip-coorg",
  title,
  categoryId,
  amount,
  paidByUserId,
  date,
  splits: splitAmount(amount, memberIds),
  ...(remark ? { remark } : {}),
});

export const transactions: Transaction[] = [
  seedExpense("tx-1", "Villa booking · first night", "stay", 18600, "user-raj", "2026-11-06", allUserIds, "Paid in advance"),
  seedExpense("tx-2", "Breakfast at Coorg Cafe", "food", 2480, "user-priya", "2026-11-07", groupOne),
  seedExpense("tx-3", "Cab from Mysore", "travel", 4200, "user-arjun", "2026-11-07", allUserIds),
  seedExpense("tx-4", "Coffee estate tour", "tickets", 3600, "user-kavita", "2026-11-08", groupTwo),
  seedExpense("tx-5", "Lunch at The Falls", "food", 5180, "user-neha", "2026-11-08", allUserIds, "Kids menu included"),
  seedExpense("tx-6", "Fuel · hill drive", "fuel", 2840, "user-dev", "2026-11-09", groupThree),
  seedExpense("tx-7", "Dinner under the stars", "food", 6460, "user-raj", "2026-11-09", allUserIds),
  seedExpense("tx-8", "Local spice market", "shopping", 1720, "user-nikhil", "2026-11-10", groupFour),
];

export const notifications = [
  { id: "note-1", text: "Neha added Lunch at The Falls", time: "Yesterday, 1:24 PM", unread: true },
  { id: "note-2", text: "Raj updated the villa booking", time: "Nov 7, 9:10 AM", unread: true },
  { id: "note-3", text: "Priya joined Coorg family escape", time: "Nov 6, 7:42 PM", unread: false },
];

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