import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  Activity,
  ArrowDownRight,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Bell,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Compass,
  CreditCard,
  Download,
  Edit2,
  FileText,
  Filter,
  Home,
  LockKeyhole,
  LogOut,
  MapPin,
  MoreHorizontal,
  Plus,
  Search,
  Share2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Smartphone,
  UsersRound,
  Wallet,
  X,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Toaster } from "@/components/ui/sonner";
import { calculateSettlement, splitAmount, type FamilyBalance } from "@/lib/settlement";
import { appPath, apiPost, loadLiveLedger, signIn as apiSignIn, validateSession, type LiveLedger } from "./api";
import {
  formatDate,
  formatRupees,
  initials,
  type Family,
  type Transaction,
  type Trip,
  type TripCategory,
  type TripUser,
} from "./data";

type Page = "trips" | "transactions" | "dashboard" | "users" | "families" | "profile" | "expense";
type UserTab = "users" | "families";
type ConfirmDetails = { title: string; message: string; action: () => void } | null;
type DirectLoginCredentials = { number: string; pass: string };

const getTripAdmins = (trip: Trip) => trip.adminUserIds?.length ? trip.adminUserIds : [trip.adminUserId];
const pageUrls: Record<Page, string> = {
  trips: "/trips", transactions: "/expenses", dashboard: "/home", users: "/people",
  families: "/families", profile: "/more", expense: "/expenses/add",
};

async function authenticate(mobile: string, password: string) {
  try {
    const result = await apiSignIn(mobile, password);
    return { ...result, error: "" };
  } catch (error) {
    return { user: null, token: "", error: error instanceof Error ? error.message : "Sign-in failed. Try again." };
  }
}

function AppLoadingShell({ page }: { page: Page }) {
  const pageMeta: Record<Page, { title: string; subtitle: string }> = {
    trips: { title: "Trips", subtitle: "Your shared adventures" },
    transactions: { title: "Expenses", subtitle: "Loading your expenses" },
    dashboard: { title: "Home", subtitle: "Your trip at a glance" },
    users: { title: "Your people", subtitle: "People in your trip" },
    families: { title: "Families", subtitle: "People in your trip" },
    profile: { title: "More", subtitle: "Account and app preferences" },
    expense: { title: "Add expense", subtitle: "Loading your trip details" },
  };
  const meta = pageMeta[page];
  const nav = [
    { page: "trips" as const, label: "Trips", icon: Compass },
    { page: "transactions" as const, label: "Expenses", icon: CreditCard },
    { page: "dashboard" as const, label: "Home", icon: Home },
    { page: "users" as const, label: "People", icon: UsersRound },
    { page: "profile" as const, label: "More", icon: MoreHorizontal },
  ];
  return <div className="trip-app-shell trip-loading-shell">
    <header className="trip-header"><div className="flex min-h-[4.1rem] items-center gap-3 px-3.5 py-2.5"><span className="trip-brand-mark">S</span><div className="min-w-0 flex-1"><h1 className="truncate text-sm font-extrabold leading-5">{meta.title}</h1><p className="trip-muted truncate text-[.68rem] leading-4">{meta.subtitle}</p></div><span className="trip-avatar size-8 text-[.62rem]">PT</span></div></header>
    <main className="trip-main"><section className="trip-loading-card" role="status" aria-live="polite"><div className="trip-loading-orbit"><span className="trip-loading-orbit-core"><Wallet size={22} /></span></div><h2 className="mt-4 text-base font-extrabold">Preparing your trip space</h2><p className="trip-muted mt-1 text-sm">Connecting securely and loading your account</p><div className="trip-skeleton-list" aria-hidden="true">{[0, 1, 2].map((row) => <div className="trip-skeleton-card" key={row}><span className="trip-skeleton-avatar" /><span className="trip-skeleton-copy"><i /><i /><i /></span><span className="trip-skeleton-value"><i /><i /></span></div>)}</div></section></main>
    <nav className="trip-bottom-nav" aria-label="Main navigation"><div className="trip-bottom-inner">{nav.map((item, index) => <div key={item.page} className="trip-bottom-item" data-active={page === item.page || (item.page === "users" && page === "families")}>{index === 2 ? <span className="trip-nav-center"><item.icon size={20} /></span> : <item.icon size={19} />}<span className={index === 2 ? "-mt-2" : ""}>{item.label}</span></div>)}</div></nav>
  </div>;
}

function useLedgerState() {
  const [families, setFamilies] = useState<Family[]>([]);
  const [users, setUsers] = useState<TripUser[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [tripUsers, setTripUsers] = useState<Record<string, string[]>>({});
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<TripCategory[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => setHydrated(true), []);

  return {
    families, setFamilies, users, setUsers, trips, setTrips, tripUsers, setTripUsers,
    transactions, setTransactions, categories, setCategories, hydrated,
  };
}

function DemoModal({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="trip-modal-content w-[calc(100%-1.5rem)] max-w-lg gap-5 rounded-lg p-5 sm:p-6">
        <DialogHeader className="text-left">
          <DialogTitle className="text-xl">{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}

function ConfirmModal({ details, close }: { details: ConfirmDetails; close: () => void }) {
  return (
    <AlertDialog open={Boolean(details)} onOpenChange={(open) => !open && close()}>
      <AlertDialogContent className="w-[calc(100%-1.5rem)] rounded-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>{details?.title ?? "Are you sure?"}</AlertDialogTitle>
          <AlertDialogDescription>{details?.message}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel asChild>
            <Button variant="outline" onClick={close}>Cancel</Button>
          </AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button onClick={() => { details?.action(); close(); }}>Yes, save</Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function Stat({ label, value, icon, note }: { label: string; value: string; icon: ReactNode; note?: string }) {
  return (
    <div className="trip-stat">
      <div className="flex items-center justify-between gap-2">
        <span className="trip-stat-label">{label}</span>
        <span className="text-muted-foreground">{icon}</span>
      </div>
      <span className="trip-stat-value">{value}</span>
      {note ? <span className="trip-muted text-xs">{note}</span> : null}
    </div>
  );
}

function BalancePill({ net }: { net: number }) {
  return (
    <span className={`trip-chip ${net >= 0 ? "trip-positive" : "trip-negative"}`}>
      {net >= 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
      {net >= 0 ? "Gets" : "Pays"} {formatRupees(Math.abs(net))}
    </span>
  );
}

function SearchableSelect({
  value,
  items,
  onChange,
  placeholder = "Choose an option",
  ariaLabel,
}: {
  value: string;
  items: { value: string; label: string }[];
  onChange: (value: string) => void;
  placeholder?: string;
  ariaLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = items.find((item) => item.value === value);
  const filtered = items.filter((item) => item.label.toLowerCase().includes(query.trim().toLowerCase()));
  return (
    <div className="trip-combobox">
      <button type="button" className="trip-select flex items-center justify-between gap-2 text-left" aria-label={ariaLabel} aria-expanded={open} onClick={() => { setOpen((current) => !current); setQuery(""); }}>
        <span className={selected ? "truncate" : "trip-muted truncate"}>{selected?.label ?? placeholder}</span><ChevronDown size={15} className="trip-muted shrink-0" />
      </button>
      {open ? <div className="trip-combobox-menu">
        <div className="relative p-2"><Search size={14} className="trip-muted absolute left-4 top-1/2 -translate-y-1/2" /><Input autoFocus className="h-9 pl-8" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search..." aria-label={`Search ${ariaLabel}`} /></div>
        <div className="max-h-52 overflow-y-auto p-1">
          {filtered.map((item) => <button key={item.value} type="button" className="flex min-h-10 w-full items-center justify-between rounded-md px-3 text-left text-sm hover:bg-muted" onClick={() => { onChange(item.value); setOpen(false); }}><span className="truncate">{item.label}</span>{item.value === value ? <Check size={15} className="text-primary" /> : null}</button>)}
          {!filtered.length ? <p className="trip-muted px-3 py-4 text-center text-sm">No matches</p> : null}
        </div>
      </div> : null}
    </div>
  );
}

function FamilyWallet({ balance }: { balance: FamilyBalance }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <section className="trip-panel overflow-hidden">
      <button
        type="button"
        className="flex min-h-16 w-full items-center gap-3 px-3.5 text-left"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
      >
        <span className="trip-avatar"><UsersRound size={17} /></span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-bold">{balance.name}</span>
          <span className="trip-muted text-xs">{balance.members.length} members · paid {formatRupees(balance.paid)}</span>
        </span>
        <BalancePill net={balance.net} />
        <ChevronDown className={`trip-muted size-4 transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>
      {expanded ? (
        <div className="border-t border-border bg-muted/40 px-4 py-2">
          <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 py-2 text-[.65rem] font-semibold uppercase text-muted-foreground">
            <span>Member</span><span>Paid</span><span>Share</span>
          </div>
          {balance.members.map((member) => (
            <div key={member.userId} className="grid grid-cols-[1fr_auto_auto] items-center gap-x-4 border-t border-border/70 py-2.5 text-xs">
              <span>{member.name}</span><span>{formatRupees(member.paid)}</span><span>{formatRupees(member.consumed)}</span>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function Dashboard({
  trip,
  currentUserId,
  families,
  users,
  transactions,
  onShare,
}: {
  trip: Trip;
  currentUserId: string;
  families: Family[];
  users: TripUser[];
  transactions: Transaction[];
  onShare: () => void;
}) {
  const [period, setPeriod] = useState("All days");
  const [expandedPeople, setExpandedPeople] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const filtered = useMemo(() => {
    if (period === "Today") return transactions.filter((transaction) => transaction.date === today);
    return transactions;
  }, [period, transactions]);
  const balances = useMemo(() => calculateSettlement(families, users, filtered), [families, filtered, users]);
  const totalPeople = Math.max(users.length, 1);
  const categoryTotals = useMemo(() => {
    const grouped = new Map<string, number>();
    filtered.forEach((item) => grouped.set(item.categoryId, (grouped.get(item.categoryId) ?? 0) + item.amount));
    return [...grouped].map(([category, amount]) => ({ category, amount }));
  }, [filtered]);
  const familyChart = balances.families.map((family) => ({
    name: family.name.split(" ")[0],
    Paid: family.paid,
    Share: family.consumed,
  }));
  const personChart = balances.people
    .map((person) => ({ name: person.name.split(" ")[0], Paid: person.paid, Share: person.consumed }))
    .sort((a, b) => b.Paid + b.Share - (a.Paid + a.Share));
  const lineChart = [...filtered]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((transaction) => ({ day: formatDate(transaction.date), amount: transaction.amount }));
  const totalToday = transactions
    .filter((transaction) => transaction.date === today)
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  const mostPayingPerson = [...balances.people].sort((a, b) => b.paid - a.paid)[0];
  const mostPayingFamily = [...balances.families].sort((a, b) => b.paid - a.paid)[0];
  const myFamily = balances.families.find((family) => family.members.some((member) => member.userId === currentUserId));

  return (
    <div className="trip-dashboard space-y-5">
      <section className="flex items-end justify-between gap-3">
        <div>
          <p className="trip-muted text-sm">{new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "long" }).format(new Date())}</p>
          <h1 className="trip-page-title mt-1">Your trip, at a glance</h1>
        </div>
        <div className="flex shrink-0 items-center gap-1 rounded-full border border-border bg-card p-1" role="group" aria-label="Expense date range">
          <button type="button" className="trip-period-button" aria-pressed={period === "All days"} onClick={() => setPeriod("All days")}>All</button>
          <button type="button" className="trip-period-button" aria-pressed={period === "Today"} onClick={() => setPeriod("Today")}><CalendarDays size={13} />Today</button>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-2.5">
        <Stat label="Trip expenses" value={formatRupees(balances.totalPaid)} icon={<Wallet size={16} />} note="Across all families" />
        <Stat label="Today's spend" value={formatRupees(totalToday)} icon={<CalendarDays size={16} />} note={new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "long" }).format(new Date())} />
        <Stat label="Transactions" value={String(filtered.length)} icon={<CreditCard size={16} />} note="Shared expenses" />
        <Stat label="Average / person" value={formatRupees(balances.totalPaid / totalPeople)} icon={<UsersRound size={16} />} note={`${users.length} travellers`} />
      </section>

      <section className="grid grid-cols-2 gap-2.5">
        <div className="trip-panel p-3.5">
          <p className="trip-muted text-xs font-semibold">Most paying person</p>
          <p className="mt-2 truncate text-sm font-bold">{mostPayingPerson?.name ?? "—"}</p>
          <p className="mt-1 text-lg font-extrabold">{formatRupees(mostPayingPerson?.paid ?? 0)}</p>
        </div>
        <div className="trip-panel p-3.5">
          <p className="trip-muted text-xs font-semibold">Leading family</p>
          <p className="mt-2 truncate text-sm font-bold">{mostPayingFamily?.name ?? "—"}</p>
          <p className="mt-1 text-lg font-extrabold">{formatRupees(mostPayingFamily?.paid ?? 0)}</p>
        </div>
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="trip-section-title">Family spending</h2><span className="trip-muted text-xs">Paid vs share</span>
        </div>
        <div className="trip-panel px-2 py-3">
          <div className="trip-chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={familyChart} barGap={3}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="name" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} width={44} tickFormatter={(value: number) => `₹${Math.round(value / 1000)}k`} />
                <Tooltip formatter={(value: number) => formatRupees(value)} />
                <Legend iconType="circle" />
                <Bar dataKey="Paid" fill="var(--color-primary)" radius={[4, 4, 0, 0]} maxBarSize={24} />
                <Bar dataKey="Share" fill="var(--color-chart-2)" radius={[4, 4, 0, 0]} maxBarSize={24} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="trip-section-title">Where the money went</h2><span className="trip-muted text-xs">By category</span>
        </div>
        <div className="trip-panel grid grid-cols-[8.5rem_1fr] items-center gap-2 p-3">
          <div className="h-36">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={categoryTotals} dataKey="amount" nameKey="category" innerRadius={39} outerRadius={64} paddingAngle={3}>
                  {categoryTotals.map((_, index) => <Cell key={`category-${index}`} fill={`var(--color-chart-${(index % 5) + 1})`} />)}
                </Pie>
                <Tooltip formatter={(value: number) => formatRupees(value)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-2">
            {categoryTotals.map((item, index) => (
              <div key={item.category} className="flex items-center justify-between gap-2 text-xs">
                <span className="flex min-w-0 items-center gap-1.5"><span className={`size-2 shrink-0 rounded-full bg-chart-${(index % 5) + 1}`} /><span className="truncate">{item.category}</span></span>
                <strong>{formatRupees(item.amount, true)}</strong>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between"><h2 className="trip-section-title">Daily spending</h2><Activity size={16} className="trip-muted" /></div>
        <div className="trip-panel px-2 py-3">
          <div className="trip-chart">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={lineChart}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="day" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} width={44} tickFormatter={(value: number) => `₹${Math.round(value / 1000)}k`} />
                <Tooltip formatter={(value: number) => formatRupees(value)} />
                <Line type="monotone" dataKey="amount" stroke="var(--color-primary)" strokeWidth={2.5} dot={{ fill: "var(--color-primary)", r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between"><h2 className="trip-section-title">Family wallets</h2><span className="trip-muted text-xs">Tap to see members</span></div>
        {balances.families.map((family) => <FamilyWallet key={family.familyId} balance={family} />)}
      </section>

      <section className="trip-panel overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-4 py-3.5">
          <div><h2 className="trip-section-title">Who pays whom</h2><p className="trip-muted mt-0.5 text-xs">Family-wise settlement</p></div>
          <span className={`trip-chip ${balances.isBalanced ? "trip-positive" : "trip-negative"}`}>
            {balances.isBalanced ? <Check size={13} /> : <CircleHelp size={13} />}
            {balances.isBalanced ? "Balanced" : "Check totals"}
          </span>
        </div>
        <div className="space-y-1 p-3.5">
          {balances.settlements.length ? balances.settlements.map((settlement) => (
            <div key={`${settlement.fromFamilyId}-${settlement.toFamilyId}`} className="flex items-center gap-2 border-b border-border/70 py-3 last:border-0 text-xs">
              <span className="min-w-0 flex-1 truncate font-semibold">{settlement.fromFamilyName}</span>
              <ArrowRight size={14} className="trip-muted shrink-0" />
              <span className="min-w-0 flex-1 truncate font-semibold">{settlement.toFamilyName}</span>
              <strong className="shrink-0">{formatRupees(settlement.amount)}</strong>
            </div>
          )) : <p className="trip-muted py-4 text-center text-sm">Everyone is settled up.</p>}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-muted/40 px-4 py-3">
          <p className="trip-muted text-xs">{trip.name} · {balances.settlements.length} transfers</p>
          <Button variant="outline" size="sm" onClick={onShare}><Share2 size={14} /> Share summary</Button>
        </div>
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="trip-section-title">Top spenders</h2>
          <Button variant="ghost" size="sm" onClick={() => setExpandedPeople((value) => !value)}>{expandedPeople ? "Top 10" : "View all"}<ChevronRight size={14} /></Button>
        </div>
        {personChart.slice(0, expandedPeople ? personChart.length : 10).length ? (
          <div className="trip-panel px-2 py-3">
            <div className="trip-chart">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={personChart.slice(0, expandedPeople ? personChart.length : 10)} layout="vertical" barGap={3}>
                  <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" width={55} tickLine={false} axisLine={false} />
                  <Tooltip formatter={(value: number) => formatRupees(value)} />
                  <Bar dataKey="Paid" fill="var(--color-primary)" radius={[0, 4, 4, 0]} maxBarSize={12} />
                  <Bar dataKey="Share" fill="var(--color-chart-2)" radius={[0, 4, 4, 0]} maxBarSize={12} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : <p className="trip-muted py-4 text-sm">No expenses in this date range.</p>}
      </section>

      <section className="trip-warm flex items-center justify-between gap-3 rounded-lg p-3.5">
        <div className="min-w-0"><p className="text-xs font-semibold">Your family position</p><p className="mt-1 truncate font-bold">{myFamily?.name ?? "No family assigned"}</p></div>
        <BalancePill net={myFamily?.net ?? 0} />
      </section>
    </div>
  );
}

function ExpenseForm({
  initial,
  users,
  families,
  categories,
  onSave,
  onConfirm,
  onAddCategory,
  currentUserId,
  isAdmin,
  onBack,
}: {
  initial: Transaction | null;
  users: TripUser[];
  families: Family[];
  categories: TripCategory[];
  onSave: (transaction: Omit<Transaction, "id" | "tripId">) => void | Promise<void>;
  onConfirm: (action: () => void, label: string, title?: string) => void;
  onAddCategory: (name: string) => TripCategory | Promise<TripCategory>;
  currentUserId: string;
  isAdmin: boolean;
  onBack: () => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? "");
  const [amount, setAmount] = useState(initial ? String(initial.amount) : "");
  const [paidByUserId, setPaidByUserId] = useState(initial?.paidByUserId ?? "");
  const [date, setDate] = useState(initial?.date ?? new Date().toISOString().slice(0, 10));
  const [selected, setSelected] = useState(initial?.splits.map((split) => split.userId) ?? []);
  const [remark, setRemark] = useState(initial?.remark ?? "");
  const [newCategoryName, setNewCategoryName] = useState("");
  const numericAmount = Number(amount);
  const effectiveSelected = selected;
  const preview = splitAmount(numericAmount, effectiveSelected);
  const toggleUser = (id: string, checked: boolean | "indeterminate") => {
    setSelected((current) => checked ? [...new Set([...current, id])] : current.filter((userId) => userId !== id));
  };
  const save = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!title.trim() || !categoryId || (isAdmin && !paidByUserId) || !Number.isFinite(numericAmount) || numericAmount <= 0 || !effectiveSelected.length) {
      toast.error("Add a title, amount, category, and at least one person to split with.");
      return;
    }
    onConfirm(() => onSave({
      title: title.trim(),
      categoryId,
      amount: Math.round(numericAmount * 100) / 100,
      paidByUserId: isAdmin ? paidByUserId : currentUserId,
      date,
      remark: remark.trim(),
      splits: preview,
      ...(initial ? { updated: true } : {}),
    }), initial ? "Save changes to this expense?" : "Add this expense to the trip?");
  };
  const createCategory = async () => {
    if (!newCategoryName.trim()) return;
    try {
      const category = await onAddCategory(newCategoryName.trim());
      setCategoryId(category.id);
      setNewCategoryName("");
      toast.success("Category added");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Category could not be saved."); }
  };

  return (
    <form className="space-y-4" onSubmit={save}>
      <div className="trip-field"><label htmlFor="expense-title">What was it for?</label><Input id="expense-title" placeholder="e.g. Dinner at the lake" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={70} required /></div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="trip-field"><label htmlFor="expense-amount">Amount (₹)</label><Input id="expense-amount" inputMode="decimal" type="number" min="0.01" step="0.01" placeholder="0.00" value={amount} onChange={(event) => setAmount(event.target.value)} required /></div>
        <div className="trip-field"><label htmlFor="expense-date">Date</label><Input id="expense-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} required /></div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="trip-field"><label>Category</label><SearchableSelect ariaLabel="Expense category" value={categoryId} onChange={setCategoryId} placeholder="Search categories" items={categories.map((category) => ({ value: category.id, label: category.name }))} /></div>
        {isAdmin ? <div className="trip-field"><label>Paid by</label><SearchableSelect ariaLabel="Paid by traveller" value={paidByUserId} onChange={setPaidByUserId} placeholder="Search travellers" items={users.map((user) => ({ value: user.id, label: user.name }))} /></div> : <div className="trip-field"><label>Paid by</label><div className="trip-select flex items-center">{users.find((user) => user.id === currentUserId)?.name ?? "You"}</div></div>}
      </div>
      <div className="flex gap-2">
        <Input aria-label="New category name" placeholder="Add a category" value={newCategoryName} onChange={(event) => setNewCategoryName(event.target.value)} maxLength={30} />
        <Button type="button" variant="outline" onClick={createCategory} disabled={!newCategoryName.trim()}><Plus size={15} /><span className="sr-only">Add category</span></Button>
      </div>
      {!isAdmin ? <p className="trip-muted text-xs">Paid by you. Choose who shares the expense.</p> : null}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-sm font-bold">Split between</p><p className="trip-muted text-xs">Choose individual travellers</p></div>
          <div className="flex gap-1.5"><Button size="sm" variant="outline" type="button" onClick={() => setSelected(users.map((user) => user.id))}>Select all families</Button><Button size="sm" variant="ghost" type="button" onClick={() => setSelected([])}>Clear</Button></div>
        </div>
        <div className="max-h-48 space-y-2 overflow-y-auto rounded-md border border-border p-3">
          {families.map((family) => {
            const members = users.filter((user) => user.familyId === family.id);
            if (!members.length) return null;
            const allSelected = members.every((member) => selected.includes(member.id));
            return <div key={family.id}><div className="flex items-center justify-between py-1.5"><span className="text-xs font-bold">{family.name}</span><Button variant="ghost" size="sm" type="button" onClick={() => setSelected((current) => allSelected ? current.filter((id) => !members.some((user) => user.id === id)) : [...new Set([...current, ...members.map((user) => user.id)])])}>{allSelected ? "Clear family" : "Select family"}</Button></div>
              <div className="grid grid-cols-2 gap-1">{members.map((user) => <label key={user.id} className="flex min-h-10 items-center gap-2 rounded px-1 text-xs"><Checkbox checked={selected.includes(user.id)} onCheckedChange={(checked) => toggleUser(user.id, checked)} /><span className="truncate">{user.name}</span></label>)}</div>
            </div>;
          })}
        </div>
        <div className="rounded-md bg-secondary/70 p-3"><div className="flex items-center justify-between text-sm"><span className="font-semibold">Each person pays</span><strong className="text-base">{selected.length && numericAmount > 0 ? formatRupees(preview[0]?.shareAmount ?? 0) : "—"}</strong></div>
          {selected.length ? <p className="trip-muted mt-1 text-xs">{selected.length} people · the first share includes any rounding paise</p> : <p className="trip-muted mt-1 text-xs">Select at least one person to preview their share.</p>}
        </div>
      </div>
      <div className="trip-field"><label htmlFor="expense-remark">Note (optional)</label><Input id="expense-remark" placeholder="Add a short note" value={remark} onChange={(event) => setRemark(event.target.value)} maxLength={180} /></div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2"><Button className="h-11 w-full" variant="outline" type="button" onClick={onBack}><ArrowLeft size={16} />Back to Home</Button><Button className="h-11 w-full" type="submit">{initial ? "Review changes" : "Review expense"}</Button></div>
    </form>
  );
}

function TripExpenseApp({ directLogin, initialPage = "dashboard" }: { directLogin?: DirectLoginCredentials; initialPage?: Page } = {}) {
  const data = useLedgerState();
  const { families, setFamilies, users, setUsers, trips, setTrips, tripUsers, setTripUsers, transactions, setTransactions, categories, setCategories } = data;
  const [page, setPage] = useState<Page>(initialPage);
  const [userTab, setUserTab] = useState<UserTab>(initialPage === "families" ? "families" : "users");
  const [activeTripId, setActiveTripId] = useState("");
  const [tripPickerOpen, setTripPickerOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [notifications, setNotifications] = useState<{ id: string; text: string; time: string; unread: boolean }[]>([]);
  const [confirmed, setConfirmed] = useState<ConfirmDetails>(null);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [tripDialog, setTripDialog] = useState(false);
  const [familyDialog, setFamilyDialog] = useState(false);
  const [userDialog, setUserDialog] = useState(false);
  const [editingUser, setEditingUser] = useState<TripUser | null>(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [showExpenseFilters, setShowExpenseFilters] = useState(false);
  const [loginVisible, setLoginVisible] = useState(true);
  const [sessionReady, setSessionReady] = useState(false);
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [sessionUserId, setSessionUserId] = useState("");
  const [directPending, setDirectPending] = useState(Boolean(directLogin));
  const directAttempted = useRef(false);
  const sessionAttempted = useRef(false);
  const [loginError, setLoginError] = useState("");
  const [apiError, setApiError] = useState("");
  const [apiRefreshing, setApiRefreshing] = useState(false);
  const [tripName, setTripName] = useState("");
  const [tripDate, setTripDate] = useState(new Date().toISOString().slice(0, 10));
  const [tripEndDate, setTripEndDate] = useState("");
  const [tripFamilyIds, setTripFamilyIds] = useState<string[]>([]);
  const [tripMemberIds, setTripMemberIds] = useState<string[]>([]);
  const [tripAdminIds, setTripAdminIds] = useState<string[]>([]);
  const [adminEditIds, setAdminEditIds] = useState<string[]>([]);
  const [adminTripId, setAdminTripId] = useState("");
  const [tripAdminsDialogOpen, setTripAdminsDialogOpen] = useState(false);
  const [newFamilyName, setNewFamilyName] = useState("");
  const [userName, setUserName] = useState("");
  const [userMobile, setUserMobile] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [userFamilyId, setUserFamilyId] = useState(families[0]?.id ?? "");
  const [familyBalancesExpanded, setFamilyBalancesExpanded] = useState<string[]>([]);
  const activeTrip = trips.find((trip) => trip.id === activeTripId) ?? trips[0];
  const activeUserIds = activeTrip ? (tripUsers[activeTrip.id] ?? []) : [];
  const activeUsers = users.filter((user) => activeUserIds.includes(user.id));
  const tripTransactions = transactions.filter((transaction) => transaction.tripId === activeTrip?.id);
  const unreadCount = notifications.filter((notification) => notification.unread).length;
  const myUser = users.find((user) => user.id === sessionUserId) ?? users[0];
  const currentUserId = myUser?.id ?? "";
  const isActiveTripAdmin = Boolean(activeTrip && getTripAdmins(activeTrip).includes(currentUserId));
  const navigatePage = (target: Page, query = "") => {
    window.history.pushState(null, "", `${appPath(pageUrls[target])}${query}`);
    setPage(target);
  };
  const applyLiveLedger = (ledger: LiveLedger) => {
    setFamilies(ledger.families);
    setUsers(ledger.users);
    setTrips(ledger.trips);
    setTripUsers(ledger.tripUsers);
    setTransactions(ledger.transactions);
    setCategories(ledger.categories);
    setNotifications(ledger.notifications);
    setApiError("");
  };
  const callApi = <T,>(endpoint: string, payload: Record<string, unknown>) => {
    const token = window.localStorage.getItem("pocket-trip-ledger:api-token");
    if (!token) throw new Error("Your sign-in has expired. Please sign in again.");
    return apiPost<T>(endpoint, payload, token);
  };
  const refreshLiveLedger = async () => {
    const token = window.localStorage.getItem("pocket-trip-ledger:api-token");
    if (!token) throw new Error("Your sign-in has expired. Please sign in again.");
    const ledger = await loadLiveLedger(token);
    applyLiveLedger(ledger);
    return ledger;
  };

  useEffect(() => {
    if (!data.hydrated || initialPage !== "expense") return;
    const editId = new URLSearchParams(window.location.search).get("editId");
    if (editId) setEditingTransaction(transactions.find((item) => item.id === editId) ?? null);
  }, [data.hydrated, initialPage, transactions]);

  useEffect(() => {
    const syncPageFromUrl = () => {
      const target = (Object.entries(pageUrls).find(([, path]) => appPath(path) === window.location.pathname)?.[0] ?? "dashboard") as Page;
      setPage(target);
      const editId = new URLSearchParams(window.location.search).get("editId");
      if (target === "expense" && editId) setEditingTransaction(transactions.find((item) => item.id === editId) ?? null);
    };
    window.addEventListener("popstate", syncPageFromUrl);
    return () => window.removeEventListener("popstate", syncPageFromUrl);
  }, [transactions]);

  useEffect(() => {
    if (data.hydrated) setActiveTripId(window.localStorage.getItem("pocket-trip-ledger:active-trip") ?? "");
  }, [data.hydrated]);

  useEffect(() => {
    if (!data.hydrated || sessionAttempted.current) return;
    sessionAttempted.current = true;
    if (directLogin && !directAttempted.current) {
      directAttempted.current = true;
      window.history.replaceState(null, "", appPath("/"));
      void (async () => {
        const result = await authenticate(directLogin.number, directLogin.pass);
        try {
          if (!result.user || !result.token) throw new Error(result.error || "Sign-in failed.");
          window.localStorage.setItem("pocket-trip-ledger:api-token", result.token);
          window.localStorage.setItem("pocket-trip-ledger:logged-in", "true");
          window.localStorage.setItem("pocket-trip-ledger:session-user-id", result.user.id);
          setSessionUserId(result.user.id);
          setMobile(result.user.mobile);
          setLoginVisible(false);
          window.history.replaceState(null, "", appPath("/home"));
          try { applyLiveLedger(await loadLiveLedger(result.token)); }
          catch (error) { setApiError(error instanceof Error ? error.message : "Could not load your data from the API."); }
          setPage("dashboard");
        } catch {
          window.localStorage.removeItem("pocket-trip-ledger:logged-in");
          window.localStorage.removeItem("pocket-trip-ledger:session-user-id");
          window.localStorage.removeItem("pocket-trip-ledger:api-token");
          window.location.replace(appPath("/logout"));
        } finally { setDirectPending(false); setSessionReady(true); }
      })();
      return;
    }
    const token = window.localStorage.getItem("pocket-trip-ledger:api-token");
    if (!token) { setSessionReady(true); return; }
    void (async () => {
      try {
        let account: TripUser;
        let ledgerResult: PromiseSettledResult<LiveLedger>;
        const ledgerRequest = loadLiveLedger(token);
        try { account = await validateSession(token); }
        catch (error) {
          void ledgerRequest.catch(() => undefined);
          window.localStorage.removeItem("pocket-trip-ledger:logged-in");
          window.localStorage.removeItem("pocket-trip-ledger:session-user-id");
          window.localStorage.removeItem("pocket-trip-ledger:api-token");
          setLoginError(error instanceof Error ? error.message : "Your saved session could not be restored.");
          setLoginVisible(true);
          return;
        }
        setSessionUserId(account.id);
        setMobile(account.mobile);
        setLoginVisible(false);
        ledgerResult = await Promise.allSettled([ledgerRequest]).then(([result]) => result);
        if (ledgerResult.status === "fulfilled") {
          const ledger = ledgerResult.value;
          applyLiveLedger(ledger);
          const savedTripId = window.localStorage.getItem("pocket-trip-ledger:active-trip") ?? "";
          setActiveTripId(ledger.trips.some((trip) => trip.id === savedTripId) ? savedTripId : ledger.trips[0]?.id ?? "");
        } else setApiError(ledgerResult.reason instanceof Error ? ledgerResult.reason.message : "Could not load your data from the API.");
      } finally { setSessionReady(true); }
    })();
  }, [data.hydrated, directLogin]);

  useEffect(() => {
    if (data.hydrated) {
      setMobile(users.find((user) => user.id === sessionUserId)?.mobile ?? "");
    }
  }, [data.hydrated, sessionUserId, users]);

  const confirm = (action: () => void, message: string, title = "Are you sure?") => setConfirmed({ title, message, action });
  const openExpense = (transaction: Transaction | null = null) => {
    if (!activeTrip) {
      toast.error("Create a trip before adding expenses.");
      navigatePage("trips");
      return;
    }
    if (transaction && !isActiveTripAdmin && transaction.paidByUserId !== currentUserId) {
      toast.error("You can only edit your own expenses.");
      return;
    }
    const query = transaction ? `?editId=${encodeURIComponent(transaction.id)}` : "";
    setEditingTransaction(transaction);
    navigatePage("expense", query);
  };
  const saveExpense = async (input: Omit<Transaction, "id" | "tripId">) => {
    if (!isActiveTripAdmin && input.paidByUserId !== currentUserId) {
      toast.error("You can only add expenses assigned to yourself.");
      return;
    }
    try {
      await callApi("expense.php", { type: 2, ...(editingTransaction ? { id: editingTransaction.id } : {}), tripId: activeTrip?.id, ...input });
      await refreshLiveLedger();
      setEditingTransaction(null);
      navigatePage("transactions");
      toast.success(editingTransaction ? "Expense updated" : "Expense added");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Expense could not be saved."); }
  };
  const confirmDelete = (transaction: Transaction) => confirm(() => {
    void (async () => {
      try {
        await callApi("expense.php", { type: 3, expense_id: transaction.id, trip_id: transaction.tripId });
        await refreshLiveLedger();
        toast.success("Expense removed");
      } catch (error) { toast.error(error instanceof Error ? error.message : "Expense could not be removed."); }
    })();
  }, `Remove “${transaction.title}” from this trip?`, "Delete expense?");
  const addCategory = async (name: string) => {
    const existing = categories.find((category) => category.name.toLowerCase() === name.toLowerCase());
    if (existing) return existing;
    const result = await callApi<{ category_id?: string | number }>("category.php", { type: 2, trip_id: activeTrip?.id, name });
    const categoryId = String(result.category_id ?? "");
    if (!categoryId) throw new Error("Category was saved but the API returned no category ID.");
    await refreshLiveLedger();
    return { id: categoryId, name };
  };
  const shareSummary = async () => {
    if (!activeTrip) return;
    const settlement = calculateSettlement(families, activeUsers, tripTransactions);
    const summary = settlement.settlements.length
      ? settlement.settlements.map((item) => `${item.fromFamilyName} pays ${item.toFamilyName} ${formatRupees(item.amount)}`).join("\n")
      : `${activeTrip.name}: everyone is settled up.`;
    if (navigator.share) {
      try { await navigator.share({ title: activeTrip.name, text: summary }); return; } catch { /* Use clipboard when sharing is dismissed or unavailable. */ }
    }
    try { await navigator.clipboard.writeText(summary); toast.success("Settlement summary copied"); }
    catch { toast.error("Sharing is not available on this device"); }
  };
  const downloadTransactions = () => {
    const cell = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;
    const rows = [
      ["Date", "Expense", "Category", "Amount", "Paid by", "Split between", "Remark"],
      ...tripTransactions.map((item) => [
        item.date,
        item.title,
        categories.find((category) => category.id === item.categoryId)?.name ?? "Other",
        item.amount.toFixed(2),
        users.find((user) => user.id === item.paidByUserId)?.name ?? "Unknown",
        item.splits.map((split) => users.find((user) => user.id === split.userId)?.name ?? "Unknown").join(", "),
        item.remark ?? "",
      ]),
    ];
    const csv = `\uFEFF${rows.map((row) => row.map(cell).join(",")).join("\r\n")}`;
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${(activeTrip?.name ?? "trip").replace(/[^a-z0-9-]+/gi, "-")}-expenses.csv`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success("Expense table downloaded");
  };
  const matchingTransactions = useMemo(() => {
    const term = search.trim().toLowerCase();
    return tripTransactions.filter((transaction) => {
      const payer = users.find((user) => user.id === transaction.paidByUserId);
      const category = categories.find((entry) => entry.id === transaction.categoryId);
      const splitNames = transaction.splits.map((split) => users.find((user) => user.id === split.userId)?.name ?? "").join(" ");
      const searchable = [transaction.title, transaction.remark, transaction.date, formatDate(transaction.date), String(transaction.amount), formatRupees(transaction.amount), payer?.name, payer?.mobile, category?.name, splitNames, transaction.id].filter(Boolean).join(" ").toLowerCase();
      const matchesText = !term || searchable.includes(term);
      const matchesCategory = categoryFilter === "all" || transaction.categoryId === categoryFilter;
      const matchesDate = dateFilter === "all" || transaction.date === dateFilter;
      return matchesText && matchesCategory && matchesDate;
    }).sort((a, b) => b.date.localeCompare(a.date));
  }, [categoryFilter, dateFilter, search, tripTransactions]);

  const changeTripFamilies = (familyId: string, checked: boolean) => {
    const nextFamilyIds = checked ? [...new Set([...tripFamilyIds, familyId])] : tripFamilyIds.filter((id) => id !== familyId);
    setTripFamilyIds(nextFamilyIds);
    const nextUsers = users.filter((user) => nextFamilyIds.includes(user.familyId)).map((user) => user.id);
    setTripMemberIds((current) => [...new Set([...nextUsers, ...current.filter((id) => !users.some((user) => user.id === id))])].filter((id) => {
      const member = users.find((user) => user.id === id);
      return !member || nextFamilyIds.includes(member.familyId);
    }));
  };
  const openTripDialog = () => {
    setTripAdminIds([currentUserId]);
    setTripDialog(true);
  };
  const openTripAdminsDialog = (trip: Trip) => {
    if (!getTripAdmins(trip).includes(currentUserId)) {
      toast.error("Only a trip admin can change trip admins.");
      return;
    }
    setAdminTripId(trip.id);
    setAdminEditIds(getTripAdmins(trip));
    setTripAdminsDialogOpen(true);
  };
  const saveTripAdmins = () => {
    if (!adminEditIds.length) {
      toast.error("Choose at least one trip admin.");
      return;
    }
    void (async () => {
      try {
        await callApi("trip.php", { type: 5, trip_id: adminTripId, adminUserIds: adminEditIds });
        await refreshLiveLedger();
        setTripAdminsDialogOpen(false);
        toast.success("Trip admins updated");
      } catch (error) { toast.error(error instanceof Error ? error.message : "Trip admins could not be updated."); }
    })();
  };
  const saveTrip = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!tripName.trim() || !tripFamilyIds.length || !tripMemberIds.length || !tripAdminIds.length || tripAdminIds.some((id) => !tripMemberIds.includes(id))) { toast.error("Add a trip name, families, travellers, and at least one trip admin."); return; }
    confirm(() => {
      void (async () => {
        try {
          const result = await callApi<{ trip_id?: string | number }>("trip.php", { type: 2, name: tripName.trim(), date: tripDate, endDate: tripEndDate, familyIds: tripFamilyIds, memberIds: tripMemberIds, adminUserIds: tripAdminIds });
          const ledger = await refreshLiveLedger();
          const id = String(result.trip_id ?? ledger.trips[0]?.id ?? "");
          if (!id) throw new Error("Trip was created but the API returned no trip ID.");
          setActiveTripId(id);
          window.localStorage.setItem("pocket-trip-ledger:active-trip", id);
          setTripName(""); setTripFamilyIds([]); setTripMemberIds([]); setTripAdminIds([]); setTripEndDate(""); setTripDialog(false); navigatePage("dashboard");
          toast.success("Trip created");
        } catch (error) { toast.error(error instanceof Error ? error.message : "Trip could not be created."); }
      })();
    }, "Create this trip with the selected families and travellers?");
  };

  const startUserEdit = (user: TripUser | null = null) => {
    setEditingUser(user);
    setUserName(user?.name ?? ""); setUserMobile(user?.mobile ?? ""); setUserEmail(user?.email ?? ""); setUserFamilyId(user?.familyId ?? families[0]?.id ?? "");
    setUserDialog(true);
  };
  const saveUser = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedMobile = userMobile.replace(/\D/g, "");
    if (normalizedMobile.length !== 10) { toast.error("Enter a valid 10-digit mobile number."); return; }
    if (userEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userEmail)) { toast.error("Enter a valid email address."); return; }
    if (users.some((user) => user.mobile === normalizedMobile && user.id !== editingUser?.id)) { toast.error("That mobile number is already in use."); return; }
    confirm(() => {
      void (async () => {
        try {
          const email = userEmail.trim() || `member-${normalizedMobile}@pocket-trip-ledger.local`;
          const result = await callApi<{ user_id?: string | number }>("user.php", { type: 2, user_id: editingUser?.id, name: userName.trim(), mobile: normalizedMobile, email, family_id: userFamilyId });
          const userId = String(result.user_id ?? editingUser?.id ?? "");
          if (!userId) throw new Error("Member was saved but the API returned no user ID.");
          if (!editingUser && activeTrip && activeTrip.familyIds.includes(userFamilyId)) {
            await callApi("trip.php", { type: 4, trip_id: activeTrip.id, memberIds: [...new Set([...(tripUsers[activeTrip.id] ?? []), userId])] });
          }
          await refreshLiveLedger();
          setUserDialog(false);
          toast.success(editingUser ? "Member details updated" : "Member added");
        } catch (error) { toast.error(error instanceof Error ? error.message : "Member could not be saved."); }
      })();
    }, `${editingUser ? "Save changes for" : "Add"} ${userName.trim()}?`);
  };

  const addFamily = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!newFamilyName.trim()) return;
    if (families.some((family) => family.name.toLowerCase() === newFamilyName.trim().toLowerCase())) { toast.error("That family name already exists."); return; }
    confirm(() => {
      void (async () => {
        try {
          const result = await callApi<{ family_id?: string | number }>("family.php", { type: 2, name: newFamilyName.trim() });
          const familyId = String(result.family_id ?? "");
          if (!familyId) throw new Error("Family was saved but the API returned no family ID.");
          await refreshLiveLedger();
          setUserFamilyId(familyId);
          setNewFamilyName(""); setFamilyDialog(false); toast.success("Family added");
        } catch (error) { toast.error(error instanceof Error ? error.message : "Family could not be added."); }
      })();
    }, `Create “${newFamilyName.trim()}”?`);
  };

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoginError("");
    if (mobile.replace(/\D/g, "").length < 10 || password.length !== 4) {
      setLoginError("Enter your registered mobile number and password.");
      return;
    }
    setLoginLoading(true);
    const result = await authenticate(mobile, password);
    if (!result.user) {
      setLoginLoading(false);
      setLoginError(result.error);
      return;
    }
    window.localStorage.setItem("pocket-trip-ledger:api-token", result.token);
    window.localStorage.setItem("pocket-trip-ledger:logged-in", "true");
    window.localStorage.setItem("pocket-trip-ledger:session-user-id", result.user.id);
    setSessionUserId(result.user.id);
    setLoginVisible(false);
    try {
      const liveLedger = await loadLiveLedger(result.token);
      applyLiveLedger(liveLedger);
      const savedTripId = window.localStorage.getItem("pocket-trip-ledger:active-trip") ?? "";
      setActiveTripId(liveLedger.trips.some((trip) => trip.id === savedTripId) ? savedTripId : liveLedger.trips[0]?.id ?? "");
    } catch (error) { setApiError(error instanceof Error ? error.message : "Could not load your ledger from the API."); }
    setPassword("");
    setLoginLoading(false);
    toast.success(`Welcome, ${result.user.name}!`);
  };

  const toggleNotification = (id: string) => {
    void (async () => {
      try { await callApi("notification.php", { type: 2, notification_id: id }); await refreshLiveLedger(); }
      catch (error) { toast.error(error instanceof Error ? error.message : "Notification could not be updated."); }
    })();
  };

  if (directPending || !sessionReady || loginLoading) return <AppLoadingShell page={initialPage} />;

  if (loginVisible) {
    return <div className="trip-login-page">
      <Toaster position="top-center" richColors />
      <section className="trip-login-card">
        <div className="trip-login-brand"><img src="https://www.sunshineinfotech.in/upload/logo/110723104513header.png" alt="Sunshine Infotech" className="trip-login-logo" /><span className="trip-login-brand-rule" /><span className="trip-login-product">Trip Management</span></div>
        <div className="trip-login-heading"><span className="trip-login-eyebrow"><span />YOUR TRIP SPACE</span><h1>Welcome back</h1><p>Sign in to pick up where your group left off.</p></div>
        <form className="trip-login-form" onSubmit={handleLogin}>
          <div className="trip-field"><label htmlFor="login-mobile">Mobile number</label><div className="trip-login-input-wrap"><Smartphone size={18} /><Input id="login-mobile" className="trip-login-input" type="tel" inputMode="numeric" autoComplete="tel" placeholder="Registered mobile number" value={mobile} onChange={(event) => setMobile(event.target.value.replace(/\D/g, "").slice(0, 15))} /></div></div>
          <div className="trip-field"><label htmlFor="login-password">Password</label><div className="trip-login-input-wrap"><LockKeyhole size={18} /><Input id="login-password" className="trip-login-input trip-login-password" type={passwordVisible ? "text" : "password"} inputMode="numeric" autoComplete="current-password" placeholder="Enter password" value={password} onChange={(event) => setPassword(event.target.value.replace(/\D/g, "").slice(0, 4))} /><button type="button" className="trip-login-reveal" onClick={() => setPasswordVisible((visible) => !visible)} aria-label={passwordVisible ? "Hide password" : "Show password"}>{passwordVisible ? "Hide" : "Show"}</button></div></div>
          {loginError ? <p className="trip-negative rounded-xl bg-destructive/5 px-3 py-2.5 text-sm" role="alert">{loginError}</p> : null}
          <Button className="trip-login-submit h-12 w-full" type="submit" disabled={loginLoading}>{loginLoading ? "Signing in…" : <>Sign in<ArrowRight size={17} /></>}</Button>
          <button type="button" className="trip-login-help" onClick={() => setForgotOpen(true)}>Forgot password? <span>Contact Vraj for help</span></button>
        </form>
        <div className="trip-login-secure"><LockKeyhole size={14} /><span>Your trip details are protected</span></div>
      </section>
      <DemoModal open={forgotOpen} onOpenChange={setForgotOpen} title="Need sign-in help?" description="Please contact Vraj for help with your account."><Button className="w-full" onClick={() => setForgotOpen(false)}>Got it</Button></DemoModal>
    </div>;
  }

  const heading = {
    trips: { title: "Trips", description: "Browse and manage your trips." },
    transactions: { title: "Expenses", description: "Browse, filter and manage expenses." },
    dashboard: { title: "Home", description: "Your trip at a glance." },
    users: { title: "Your people", description: "" },
    families: { title: "Families", description: "" },
    profile: { title: "More", description: "Account and app preferences." },
    expense: { title: editingTransaction ? "Edit expense" : "Add expense", description: activeTrip?.name ?? "" },
  }[page];

  return (
    <div className="trip-app-shell">
      <Toaster position="top-center" richColors />
      <header className="trip-header">
        {page === "expense" ? <div className="relative flex h-[4.1rem] items-center justify-between px-3"><Button variant="ghost" size="icon" aria-label="Back to Home" onClick={() => navigatePage("dashboard")}><ArrowLeft size={20} /></Button><h1 className="absolute left-1/2 -translate-x-1/2 text-base font-extrabold">{editingTransaction ? "Edit expense" : "Add expense"}</h1><span className="size-10" /></div> : <div className="flex min-h-[4.1rem] items-center gap-3 px-3.5 py-2.5">
          <span className="trip-brand-mark">S</span>
          <div className="min-w-0 flex-1"><h1 className="truncate text-sm font-extrabold leading-5">{heading.title}</h1><p className="trip-muted truncate text-[.68rem] leading-4">{heading.description}</p></div>
          <button type="button" className="flex max-w-[8.5rem] shrink-0 items-center gap-1 rounded-full px-1.5 py-1 text-left" onClick={() => navigatePage("profile")} aria-label="More and account"><span className="trip-avatar size-8 text-[.62rem]">{initials(myUser?.name ?? "Vraj")}</span></button>
          <Button variant="ghost" size="icon" className="relative size-9 shrink-0" aria-label="Notifications" onClick={() => setNotificationOpen(true)}><Bell size={17} />{unreadCount ? <span className="absolute right-1 top-1 size-2 rounded-full bg-primary ring-2 ring-background" /> : null}</Button>
        </div>}
      </header>

      <main className="trip-main">
        {apiError ? <section className="trip-panel mb-4 flex flex-wrap items-center justify-between gap-3 border border-destructive/25 bg-destructive/[.04] p-4" role="alert"><div><h2 className="text-sm font-bold">Could not load live data</h2><p className="trip-muted mt-1 text-sm">{apiError}</p></div><Button variant="outline" disabled={apiRefreshing} onClick={() => { const token = window.localStorage.getItem("pocket-trip-ledger:api-token"); if (!token) return; setApiRefreshing(true); void loadLiveLedger(token).then(applyLiveLedger).catch((error) => setApiError(error instanceof Error ? error.message : "Could not load live data.")).finally(() => setApiRefreshing(false)); }}>{apiRefreshing ? "Loading…" : "Retry"}</Button></section> : null}
        {page === "dashboard" && activeTrip ? <div className="mb-3 flex items-center gap-2"><MapPin size={14} className="text-primary" /><span className="trip-muted text-xs font-semibold">{activeTrip.name}</span></div> : null}

        {page === "dashboard" && activeTrip ? <Dashboard trip={activeTrip} currentUserId={currentUserId} families={families} users={activeUsers} transactions={tripTransactions} onShare={shareSummary} /> : null}
        {page === "dashboard" && !activeTrip ? <section className="trip-panel flex flex-col items-center px-6 py-12 text-center"><span className="grid size-14 place-items-center rounded-full bg-warm text-primary"><Compass size={24} /></span><h1 className="trip-page-title mt-4">Your ledger starts here</h1><p className="trip-muted mt-2 max-w-sm text-sm">Add a family, invite travellers, and create your first trip. Expenses and balances will appear as you enter them.</p><Button className="mt-5" onClick={() => families.length ? openTripDialog() : setFamilyDialog(true)}><Plus size={16} />{families.length ? "Create your first trip" : "Add your first family"}</Button></section> : null}

        {page === "trips" ? <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2"><p className="trip-muted text-sm">{trips.length} {trips.length === 1 ? "trip" : "trips"}</p><div className="flex gap-2">{activeTrip && isActiveTripAdmin ? <Button variant="outline" onClick={() => openTripAdminsDialog(activeTrip)}><UsersRound size={15} />Manage admins</Button> : null}<Button onClick={openTripDialog}><Plus size={16} />New trip</Button></div></div>
          {trips.map((trip) => {
            const memberIds = tripUsers[trip.id] ?? [];
            const memberList = users.filter((user) => memberIds.includes(user.id));
            const expenseTotal = transactions.filter((transaction) => transaction.tripId === trip.id).reduce((sum, item) => sum + item.amount, 0);
            const isCurrent = trip.id === activeTrip?.id;
            return <button type="button" key={trip.id} onClick={() => { setActiveTripId(trip.id); window.localStorage.setItem("pocket-trip-ledger:active-trip", trip.id); navigatePage("dashboard"); }} className={`trip-panel block w-full p-4 text-left ${isCurrent ? "border-primary/50" : ""}`}>
              <div className="flex items-start justify-between gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-lg bg-warm text-primary"><Compass size={20} /></span><span className="trip-chip">{isCurrent ? <Check size={12} /> : <ChevronRight size={13} />}{isCurrent ? "Current trip" : "Open trip"}</span></div>
              <h2 className="mt-4 text-lg font-extrabold">{trip.name}</h2><p className="trip-muted mt-1 flex items-center gap-1.5 text-xs"><CalendarDays size={13} />{formatDate(trip.date)}{trip.endDate ? ` – ${formatDate(trip.endDate)}` : ""}</p>
              <div className="mt-4 flex items-center justify-between gap-2 border-t border-border pt-3"><div className="flex -space-x-2">{memberList.slice(0, 4).map((member) => <span key={member.id} title={member.name} className="trip-avatar size-7 border-2 border-card text-[.58rem]">{initials(member.name)}</span>)}{memberList.length > 4 ? <span className="grid size-7 place-items-center rounded-full border-2 border-card bg-muted text-[.58rem] font-bold">+{memberList.length - 4}</span> : null}</div><div className="text-right"><p className="text-sm font-bold">{formatRupees(expenseTotal)}</p><p className="trip-muted text-[.68rem]">{trip.familyIds.length} families · {getTripAdmins(trip).length} admins · {memberIds.length} people</p></div></div>
            </button>;
          })}
          <div className="trip-warm flex items-start gap-3 rounded-lg p-4"><Sparkles size={18} className="mt-0.5 shrink-0 text-primary" /><div><p className="text-sm font-bold">A trip together, made simpler</p><p className="trip-muted mt-1 text-xs leading-relaxed">Add the shared costs as they happen. Every family can see their balance settle along the way.</p></div></div>
        </div> : null}

        {page === "transactions" ? <div className="space-y-4">
          <div className="relative"><Search size={17} className="trip-muted absolute left-3.5 top-1/2 -translate-y-1/2" /><Input className="trip-search h-12 rounded-xl pl-10 pr-4" placeholder="Search expenses" value={search} onChange={(event) => setSearch(event.target.value)} aria-label="Search expenses by amount, person, date or details" /></div>
          <div className="flex flex-wrap items-center justify-between gap-2"><p className="trip-muted text-sm">{matchingTransactions.length} expenses</p><div className="flex flex-wrap gap-2"><Button size="icon" variant="outline" className="trip-filter-button" aria-label={showExpenseFilters ? "Hide filters" : "Show filters"} title={showExpenseFilters ? "Hide filters" : "Show filters"} aria-expanded={showExpenseFilters} onClick={() => setShowExpenseFilters((show) => !show)}><Filter size={16} /></Button><Button size="sm" variant="outline" className="trip-download-button" onClick={downloadTransactions}><Download size={15} />CSV</Button><Button size="sm" className="trip-add-button" onClick={() => openExpense()}><Plus size={15} />Add expense</Button></div></div>
          {showExpenseFilters ? <div className="trip-panel trip-filter-panel space-y-2 p-3"><p className="trip-group-label mt-0">FILTER EXPENSES</p><div className="grid grid-cols-1 gap-2 sm:grid-cols-2"><div className="flex items-center gap-2"><Filter size={14} className="trip-muted shrink-0" /><SearchableSelect ariaLabel="Filter by category" value={categoryFilter} onChange={setCategoryFilter} placeholder="All categories" items={[{ value: "all", label: "All categories" }, ...categories.map((category) => ({ value: category.id, label: category.name }))]} /></div><div className="flex items-center gap-2"><SlidersHorizontal size={14} className="trip-muted shrink-0" /><SearchableSelect ariaLabel="Filter by date" value={dateFilter} onChange={setDateFilter} placeholder="All dates" items={[{ value: "all", label: "All dates" }, ...[...new Set(tripTransactions.map((item) => item.date))].sort((a, b) => b.localeCompare(a)).map((date) => ({ value: date, label: formatDate(date) }))]} /></div></div>
          </div> : null}
          {matchingTransactions.length ? <div className="space-y-2">{matchingTransactions.map((item) => {
            const payer = users.find((user) => user.id === item.paidByUserId);
            const category = categories.find((entry) => entry.id === item.categoryId)?.name ?? "Other";
            const canManage = isActiveTripAdmin || item.paidByUserId === currentUserId;
            const tone = Math.abs([...item.categoryId].reduce((sum, char) => sum + char.charCodeAt(0), 0)) % 4;
            return <article key={item.id} className="trip-expense-card" data-tone={tone}><div className="trip-expense-accent" /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="truncate text-sm font-extrabold">{item.title}</h2>{item.updated ? <span className="trip-chip px-1.5 py-0.5 text-[.58rem]">Edited</span> : null}</div><span className="trip-expense-category mt-2">{category}</span><p className="mt-2 break-words text-sm">{item.remark?.trim() || <span className="trip-muted">No remark</span>}</p><p className="trip-muted mt-2 text-xs"><strong className="text-foreground">Paid by {payer?.name ?? "Unknown"}</strong> · split with {item.splits.map((split) => users.find((user) => user.id === split.userId)?.name ?? "Unknown").join(", ")}</p></div><div className="flex shrink-0 flex-col items-end gap-1.5 text-right"><time className="trip-muted text-xs">{formatDate(item.date)}</time><strong className="trip-expense-amount text-base">{formatRupees(item.amount)}</strong>{canManage ? <div className="flex gap-0.5"><Button variant="ghost" size="icon" className="size-8" onClick={() => openExpense(item)} aria-label={`Edit ${item.title}`}><Edit2 size={14} /></Button><Button variant="ghost" size="icon" className="size-8 text-destructive" onClick={() => confirmDelete(item)} aria-label={`Delete ${item.title}`}><X size={15} /></Button></div> : <span className="trip-muted text-[.65rem]">View only</span>}</div></article>;
          })}</div> : <div className="trip-panel flex flex-col items-center px-5 py-12 text-center"><span className="grid size-12 place-items-center rounded-full bg-muted text-muted-foreground"><Search size={20} /></span><h2 className="mt-3 font-bold">No expenses found</h2><p className="trip-muted mt-1 text-sm">Try a different search or add a trip expense.</p><Button className="mt-4" onClick={() => openExpense()}><Plus size={16} />Add expense</Button></div>}
        </div> : null}

        {page === "expense" ? <section className="trip-expense-form"><ExpenseForm key={editingTransaction?.id ?? "new-expense"} initial={editingTransaction} users={activeUsers} families={families.filter((family) => activeTrip?.familyIds.includes(family.id))} categories={categories} onSave={saveExpense} onConfirm={(action, message) => confirm(action, message)} onAddCategory={addCategory} currentUserId={currentUserId} isAdmin={isActiveTripAdmin} onBack={() => navigatePage("dashboard")} /></section> : null}

        {(page === "users" || page === "families") ? <div className="space-y-4">
          <div className="flex gap-1 rounded-lg bg-muted p-1"><Button variant={page === "users" ? "default" : "ghost"} className="h-10 flex-1" onClick={() => navigatePage("users")}><UsersRound size={15} />People</Button><Button variant={page === "families" ? "default" : "ghost"} className="h-10 flex-1" onClick={() => navigatePage("families")}><Home size={15} />Families</Button></div>
          {userTab === "users" ? <><div className="flex items-center justify-between gap-2"><p className="trip-muted text-sm">{users.length} people · {families.length} families</p><Button onClick={() => startUserEdit()}><Plus size={16} />Add member</Button></div><div className="relative"><Search size={16} className="trip-muted absolute left-3 top-1/2 -translate-y-1/2" /><Input className="trip-search pl-9" placeholder="Search people, mobile or family" value={search} onChange={(event) => setSearch(event.target.value)} aria-label="Search people" /></div><div className="space-y-2">{families.map((family) => { const members = users.filter((user) => user.familyId === family.id && `${user.name} ${user.mobile} ${family.name}`.toLowerCase().includes(search.toLowerCase())); if (search && !members.length) return null; const head = users.find((user) => user.id === family.headUserId); const expanded = familyBalancesExpanded.includes(family.id) || Boolean(search); return <section key={family.id} className="trip-list-group"><button className="flex min-h-16 w-full items-center gap-3 px-3.5 text-left" type="button" aria-expanded={expanded} onClick={() => setFamilyBalancesExpanded((items) => expanded && !search ? items.filter((id) => id !== family.id) : [...new Set([...items, family.id])])}><span className="trip-list-icon"><Home size={17} /></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold">{family.name}</span><span className="trip-muted block truncate text-xs">{members.length} people · Head: {head?.name ?? "Not assigned"}</span></span><ChevronDown className={`trip-muted size-4 transition-transform ${expanded ? "rotate-180" : ""}`} /></button>{expanded ? <div className="border-t border-border px-3">{members.map((user) => <div key={user.id} className="trip-row"><span className="trip-avatar">{initials(user.name)}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{user.name}</p><p className="trip-muted truncate text-xs">{user.mobile}{user.id === family.headUserId ? " · Family head" : ""}</p></div><Button size="icon" variant="ghost" aria-label={`Edit ${user.name}`} onClick={() => startUserEdit(user)}><Edit2 size={15} /></Button></div>)}</div> : null}</section>; })}</div><Button variant="outline" className="w-full" onClick={() => setFamilyDialog(true)}><Plus size={15} />Add family</Button></> : <><div className="flex items-center justify-between gap-2"><p className="trip-muted text-sm">{families.length} families</p><Button onClick={() => setFamilyDialog(true)}><Plus size={16} />Add family</Button></div><div className="space-y-2">{families.map((family) => { const members = users.filter((user) => user.familyId === family.id); const head = users.find((user) => user.id === family.headUserId); const expanded = familyBalancesExpanded.includes(family.id); return <section key={family.id} className="trip-list-group"><button className="flex min-h-16 w-full items-center gap-3 px-3.5 text-left" type="button" aria-expanded={expanded} onClick={() => setFamilyBalancesExpanded((items) => expanded ? items.filter((id) => id !== family.id) : [...items, family.id])}><span className="trip-list-icon"><Home size={17} /></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold">{family.name}</span><span className="trip-muted block truncate text-xs">{members.length} people · Head: {head?.name ?? "Not assigned"}</span></span><ChevronDown className={`trip-muted size-4 transition-transform ${expanded ? "rotate-180" : ""}`} /></button>{expanded ? <div className="border-t border-border px-3">{members.map((user) => <div key={user.id} className="trip-row"><span className="trip-avatar size-8">{initials(user.name)}</span><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold">{user.name}</p></div>{user.id === family.headUserId ? <span className="trip-chip">Head</span> : null}<div className="w-36"><SearchableSelect ariaLabel={`Move ${user.name} to family`} value={user.familyId} onChange={async (value) => { try { await callApi("family.php", { type: 3, family_id: value, user_id: user.id }); await refreshLiveLedger(); toast.success(`${user.name} family updated`); } catch (error) { toast.error(error instanceof Error ? error.message : "Family could not be changed."); } }} items={families.map((entry) => ({ value: entry.id, label: entry.name }))} /></div></div>)}</div> : null}</section>; })}</div></>}
        </div> : null}

        {page === "profile" ? <div className="space-y-4">
          <section className="trip-account-card"><span className="trip-avatar size-14 text-base">{initials(myUser?.name ?? "Vraj")}</span><div className="min-w-0 flex-1"><h2 className="truncate text-sm font-extrabold">{myUser?.name ?? "Vraj"}</h2><p className="trip-muted text-xs">Account & app preferences</p><p className="trip-muted mt-1 truncate text-[.68rem]">{myUser?.mobile ?? ""} · {families.find((family) => family.id === myUser?.familyId)?.name ?? "No family"}</p></div><Button size="icon" variant="ghost" aria-label="Edit profile" onClick={() => startUserEdit(myUser ?? null)}><Edit2 size={16} /></Button></section>
          <section><h2 className="trip-group-label">QUICK ACTIONS</h2><div className="trip-list-group">{[{ title: "Home", icon: Home, action: () => navigatePage("dashboard") }, { title: "Trips", icon: Compass, action: () => navigatePage("trips") }, { title: "Expenses", icon: CreditCard, action: () => navigatePage("transactions") }, { title: "People & families", icon: UsersRound, action: () => navigatePage("users") }].map((item) => <button type="button" key={item.title} className="trip-more-row" onClick={item.action}><span className="trip-list-icon"><item.icon size={17} /></span><span className="flex-1 text-sm font-semibold">{item.title}</span><ChevronRight className="trip-muted size-4" /></button>)}</div></section>
          <section><h2 className="trip-group-label">ABOUT</h2><div className="trip-about-card"><div><p className="trip-muted text-xs">Developed by</p><a href="https://www.sunshineinfotech.in/" target="_blank" rel="noreferrer" className="text-sm font-bold">Sunshine Infotech</a></div><a href="https://www.sunshineinfotech.in/" target="_blank" rel="noreferrer" className="text-xs font-semibold text-primary">sunshineinfotech.in ↗</a><div className="col-span-2 flex justify-between border-t border-border pt-3 text-xs"><span className="trip-muted">Version</span><span className="font-semibold">1.0.0.3</span></div></div></section>
          <Button variant="outline" className="h-11 w-full border-destructive/25 bg-destructive/5 text-destructive hover:bg-destructive/10" onClick={() => window.location.assign(appPath("/logout"))}><LogOut size={16} />Log out</Button>
          <p className="trip-muted pb-5 text-center text-[.65rem]">© 2026 Sunshine Infotech. All rights reserved.</p>
        </div> : null}
      </main>

      {page !== "expense" ? <nav className="trip-bottom-nav" aria-label="Main navigation"><div className="trip-bottom-inner">
        {([
          { id: "trips" as const, label: "Trips", icon: Compass },
          { id: "transactions" as const, label: "Expenses", icon: CreditCard },
          { id: "dashboard" as const, label: "Home", icon: Home },
          { id: "users" as const, label: "People", icon: UsersRound },
          { id: "profile" as const, label: "More", icon: MoreHorizontal },
        ]).map((item, index) => <button key={item.id} type="button" className="trip-bottom-item" data-active={page === item.id || (item.id === "users" && page === "families")} onClick={() => navigatePage(item.id)} aria-current={page === item.id || (item.id === "users" && page === "families") ? "page" : undefined}>
          {index === 2 ? <span className="trip-nav-center"><item.icon size={20} /></span> : <item.icon size={19} />}<span className={index === 2 ? "-mt-2" : ""}>{item.label}</span>
        </button>)}
      </div></nav> : null}

      <DemoModal open={tripPickerOpen} onOpenChange={setTripPickerOpen} title="Choose a trip" description="Your expenses and balances follow the selected trip.">
        <div className="space-y-2">{trips.map((trip) => <button key={trip.id} type="button" className={`flex w-full items-center gap-3 rounded-md border p-3 text-left ${activeTrip?.id === trip.id ? "border-primary bg-warm" : "border-border"}`} onClick={() => { setActiveTripId(trip.id); window.localStorage.setItem("pocket-trip-ledger:active-trip", trip.id); setTripPickerOpen(false); }}><span className="grid size-9 place-items-center rounded-full bg-muted text-primary"><MapPin size={17} /></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold">{trip.name}</span><span className="trip-muted text-xs">{formatDate(trip.date)} · {(tripUsers[trip.id] ?? []).length} travellers</span></span>{activeTrip?.id === trip.id ? <Check size={17} className="text-primary" /> : null}</button>)}<Button className="w-full" variant="outline" onClick={() => { setTripPickerOpen(false); openTripDialog(); }}><Plus size={15} />Create a trip</Button></div>
      </DemoModal>

      <DemoModal open={tripAdminsDialogOpen} onOpenChange={setTripAdminsDialogOpen} title="Manage trip admins" description="Choose one or more trip members who can add expenses for anyone.">
        <div className="space-y-3">
          <div className="max-h-72 space-y-1 overflow-y-auto rounded-lg border border-border p-2">
            {(tripUsers[adminTripId ?? ""] ?? []).map((userId) => users.find((user) => user.id === userId)).filter((user): user is TripUser => Boolean(user)).map((user) => <label key={user.id} className="flex cursor-pointer items-center gap-3 rounded-md p-2 hover:bg-muted"><Checkbox checked={adminEditIds.includes(user.id)} onCheckedChange={(checked) => setAdminEditIds((current) => checked === true ? [...new Set([...current, user.id])] : current.filter((id) => id !== user.id))} /><span className="trip-avatar size-8 text-xs">{initials(user.name)}</span><span className="flex-1 text-sm font-semibold">{user.name}</span>{user.id === currentUserId ? <span className="trip-chip">You</span> : null}</label>)}
          </div>
          {!adminEditIds.length ? <p className="trip-negative text-xs">At least one admin is required.</p> : null}
          <Button className="h-11 w-full" disabled={!adminEditIds.length} onClick={saveTripAdmins}>Save admins</Button>
        </div>
      </DemoModal>

      <DemoModal open={notificationOpen} onOpenChange={setNotificationOpen} title="Notifications" description="The latest from your trip group.">
        <div className="divide-y divide-border">{notifications.map((notification) => <button key={notification.id} type="button" onClick={() => toggleNotification(notification.id)} className="flex w-full items-start gap-3 py-3.5 text-left"><span className={`mt-1.5 size-2 shrink-0 rounded-full ${notification.unread ? "bg-primary" : "bg-border"}`} /><span className="min-w-0 flex-1"><span className="block text-sm font-medium">{notification.text}</span><span className="trip-muted mt-1 block text-xs">{notification.time}</span></span>{notification.unread ? <span className="trip-chip">New</span> : null}</button>)}{!notifications.length ? <p className="trip-muted py-8 text-center text-sm">You're all caught up.</p> : null}</div>
      </DemoModal>

      <DemoModal open={tripDialog} onOpenChange={setTripDialog} title="Plan a trip" description="Start the shared expense list for your group.">
        <form className="space-y-4" onSubmit={saveTrip}>
          <div className="trip-field"><label htmlFor="trip-name">Trip name</label><Input id="trip-name" placeholder="e.g. Summer by the sea" value={tripName} onChange={(event) => setTripName(event.target.value)} required maxLength={60} /></div>
          <div className="grid grid-cols-2 gap-3"><div className="trip-field"><label htmlFor="trip-start">Start date</label><Input id="trip-start" type="date" value={tripDate} onChange={(event) => setTripDate(event.target.value)} required /></div><div className="trip-field"><label htmlFor="trip-end">End date (optional)</label><Input id="trip-end" type="date" value={tripEndDate} min={tripDate} onChange={(event) => setTripEndDate(event.target.value)} /></div></div>
          <div><div className="mb-2 flex items-center justify-between"><p className="text-sm font-bold">Invite families</p><span className="trip-muted text-xs">{tripFamilyIds.length} selected</span></div><div className="max-h-52 space-y-1 overflow-y-auto rounded-md border border-border p-2">{families.map((family) => <label key={family.id} className="flex cursor-pointer items-center gap-3 rounded p-2 hover:bg-muted"><Checkbox checked={tripFamilyIds.includes(family.id)} onCheckedChange={(checked) => changeTripFamilies(family.id, checked === true)} /><span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{family.name}</span><span className="trip-muted text-xs">{users.filter((user) => user.familyId === family.id).map((user) => user.name.split(" ")[0]).join(", ") || "No members yet"}</span></span></label>)}</div></div>
          <div><div className="mb-2 flex items-center justify-between"><p className="text-sm font-bold">Travellers coming</p><Button type="button" size="sm" variant="ghost" onClick={() => setTripMemberIds(users.filter((user) => tripFamilyIds.includes(user.familyId)).map((user) => user.id))}>Select families</Button></div><div className="max-h-40 space-y-1 overflow-y-auto rounded-md border border-border p-2">{users.map((user) => <label key={user.id} className="flex items-center gap-3 rounded p-2"><Checkbox checked={tripMemberIds.includes(user.id)} onCheckedChange={(checked) => setTripMemberIds((current) => checked === true ? [...new Set([...current, user.id])] : current.filter((id) => id !== user.id))} /><span className="flex-1 text-sm">{user.name}</span><span className="trip-muted text-xs">{families.find((family) => family.id === user.familyId)?.name}</span></label>)}</div></div>
          <section className="space-y-2"><div><p className="text-sm font-bold">Trip admins</p><p className="trip-muted text-xs">Admins can add expenses for any traveller.</p></div><div className="max-h-40 space-y-1 overflow-y-auto rounded-md border border-border p-2">{users.filter((user) => tripMemberIds.includes(user.id)).map((user) => <label key={user.id} className="flex items-center gap-3 rounded p-2"><Checkbox checked={tripAdminIds.includes(user.id)} onCheckedChange={(checked) => setTripAdminIds((current) => checked === true ? [...new Set([...current, user.id])] : current.filter((id) => id !== user.id))} /><span className="flex-1 text-sm">{user.name}</span>{user.id === currentUserId ? <span className="trip-chip">You</span> : null}</label>)}{!tripMemberIds.length ? <p className="trip-muted p-3 text-center text-xs">Choose travellers first.</p> : null}</div></section>
          <Button className="h-11 w-full" type="submit">Review trip</Button>
        </form>
      </DemoModal>

      <DemoModal open={familyDialog} onOpenChange={setFamilyDialog} title="Add a family" description="Create a family group for your travellers.">
        <form className="space-y-4" onSubmit={addFamily}><div className="trip-field"><label htmlFor="family-name">Family name</label><Input id="family-name" placeholder="e.g. Rao family" value={newFamilyName} onChange={(event) => setNewFamilyName(event.target.value)} maxLength={50} required /></div><Button className="h-11 w-full" type="submit">Review family</Button></form>
      </DemoModal>

      <DemoModal open={userDialog} onOpenChange={setUserDialog} title={editingUser ? "Edit traveller" : "Add a traveller"} description="Keep contact details and family groups up to date.">
        <form className="space-y-4" onSubmit={saveUser}><div className="trip-field"><label htmlFor="user-name">Full name</label><Input id="user-name" autoComplete="name" placeholder="Traveller name" value={userName} onChange={(event) => setUserName(event.target.value)} required maxLength={70} /></div><div className="trip-field"><label htmlFor="user-mobile">Mobile number</label><Input id="user-mobile" autoComplete="tel" inputMode="numeric" placeholder="10-digit number" value={userMobile} onChange={(event) => setUserMobile(event.target.value.replace(/\D/g, "").slice(0, 10))} required /></div><div className="trip-field"><label htmlFor="user-email">Email address (optional)</label><Input id="user-email" type="email" autoComplete="email" placeholder="name@example.com" value={userEmail} onChange={(event) => setUserEmail(event.target.value)} /></div><div className="trip-field"><label>Family</label><SearchableSelect ariaLabel="Assign family" value={userFamilyId} onChange={setUserFamilyId} placeholder="No family yet" items={[{ value: "", label: "No family yet" }, ...families.map((family) => ({ value: family.id, label: `${family.name} — ${users.filter((user) => user.familyId === family.id).map((user) => user.name.split(" ")[0]).join(", ") || "No members"}` }))]} /></div><Button className="h-11 w-full" type="submit">Review details</Button></form>
      </DemoModal>

      <ConfirmModal details={confirmed} close={() => setConfirmed(null)} />
    </div>
  );
}

export { TripExpenseApp };
