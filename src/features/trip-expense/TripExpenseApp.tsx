import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
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
  LogOut,
  MapPin,
  MoreHorizontal,
  Plus,
  Search,
  Share2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
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
import sunshineLogo from "@/assets/sunshine-logo.png.asset.json";
import { calculateSettlement, splitAmount, type FamilyBalance } from "@/lib/settlement";
import {
  categories as seedCategories,
  families as seedFamilies,
  formatDate,
  formatRupees,
  initials,
  notifications as seedNotifications,
  transactions as seedTransactions,
  trips as seedTrips,
  tripUsers as seedTripUsers,
  users as seedUsers,
  type Family,
  type Transaction,
  type Trip,
  type TripCategory,
  type TripUser,
} from "./data";

type Page = "trips" | "transactions" | "dashboard" | "users" | "profile";
type UserTab = "users" | "families";
type ConfirmDetails = { title: string; message: string; action: () => void } | null;

function useLocalDemoData() {
  const [families, setFamilies] = useState(seedFamilies);
  const [users, setUsers] = useState(seedUsers);
  const [trips, setTrips] = useState(seedTrips);
  const [tripUsers, setTripUsers] = useState(seedTripUsers);
  const [transactions, setTransactions] = useState(seedTransactions);
  const [categories, setCategories] = useState(seedCategories);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const read = <T,>(key: string, fallback: T): T => {
      try {
        const raw = window.localStorage.getItem(`sunshine-trip-demo:${key}`);
        return raw ? (JSON.parse(raw) as T) : fallback;
      } catch {
        return fallback;
      }
    };
    setFamilies(read("families", seedFamilies));
    setUsers(read("users", seedUsers));
    setTrips(read("trips", seedTrips));
    setTripUsers(read("tripUsers", seedTripUsers));
    setTransactions(read("transactions", seedTransactions));
    setCategories(read("categories", seedCategories));
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem("sunshine-trip-demo:families", JSON.stringify(families));
    window.localStorage.setItem("sunshine-trip-demo:users", JSON.stringify(users));
    window.localStorage.setItem("sunshine-trip-demo:trips", JSON.stringify(trips));
    window.localStorage.setItem("sunshine-trip-demo:tripUsers", JSON.stringify(tripUsers));
    window.localStorage.setItem("sunshine-trip-demo:transactions", JSON.stringify(transactions));
    window.localStorage.setItem("sunshine-trip-demo:categories", JSON.stringify(categories));
  }, [categories, families, hydrated, transactions, tripUsers, trips, users]);

  return {
    families, setFamilies, users, setUsers, trips, setTrips, tripUsers, setTripUsers,
    transactions, setTransactions, categories, setCategories,
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
  families,
  users,
  transactions,
  onShare,
}: {
  trip: Trip;
  families: Family[];
  users: TripUser[];
  transactions: Transaction[];
  onShare: () => void;
}) {
  const [period, setPeriod] = useState("All days");
  const [expandedPeople, setExpandedPeople] = useState(false);
  const today = "2026-11-10";
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
  const myFamily = balances.families.find((family) => family.members.some((member) => member.userId === "user-raj"));

  return (
    <div className="space-y-5">
      <section className="flex items-end justify-between gap-3">
        <div>
          <p className="trip-muted text-sm">Tuesday, 10 November</p>
          <h1 className="trip-page-title mt-1">Your trip, at a glance</h1>
        </div>
        <label className="flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-2 text-xs font-semibold">
          <CalendarDays size={14} className="text-primary" />
          <select className="max-w-[5.5rem] bg-transparent outline-none" value={period} onChange={(event) => setPeriod(event.target.value)} aria-label="Expense date range">
            <option>All days</option><option>Today</option>
          </select>
        </label>
      </section>

      <section className="grid grid-cols-2 gap-2.5">
        <Stat label="Trip expenses" value={formatRupees(balances.totalPaid)} icon={<Wallet size={16} />} note="Across all families" />
        <Stat label="Today's spend" value={formatRupees(totalToday)} icon={<CalendarDays size={16} />} note="10 November" />
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
}: {
  initial: Transaction | null;
  users: TripUser[];
  families: Family[];
  categories: TripCategory[];
  onSave: (transaction: Omit<Transaction, "id" | "tripId">) => void;
  onConfirm: (action: () => void, label: string) => void;
  onAddCategory: (name: string) => TripCategory;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? categories[0]?.id ?? "");
  const [amount, setAmount] = useState(initial ? String(initial.amount) : "");
  const [paidByUserId, setPaidByUserId] = useState(initial?.paidByUserId ?? "user-raj");
  const [date, setDate] = useState(initial?.date ?? "2026-11-10");
  const [selected, setSelected] = useState(initial?.splits.map((split) => split.userId) ?? users.map((user) => user.id));
  const [remark, setRemark] = useState(initial?.remark ?? "");
  const [newCategoryName, setNewCategoryName] = useState("");
  const numericAmount = Number(amount);
  const preview = splitAmount(numericAmount, selected);
  const toggleUser = (id: string, checked: boolean | "indeterminate") => {
    setSelected((current) => checked ? [...new Set([...current, id])] : current.filter((userId) => userId !== id));
  };
  const save = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!title.trim() || !categoryId || !Number.isFinite(numericAmount) || numericAmount <= 0 || !selected.length) {
      toast.error("Add a title, amount, category, and at least one person to split with.");
      return;
    }
    onConfirm(() => onSave({
      title: title.trim(),
      categoryId,
      amount: Math.round(numericAmount * 100) / 100,
      paidByUserId,
      date,
      remark: remark.trim(),
      splits: preview,
      ...(initial ? { updated: true } : {}),
    }), initial ? "Save changes to this expense?" : "Add this expense to the trip?");
  };
  const createCategory = () => {
    if (!newCategoryName.trim()) return;
    const category = onAddCategory(newCategoryName.trim());
    setCategoryId(category.id);
    setNewCategoryName("");
    toast.success("Category added");
  };

  return (
    <form className="space-y-4" onSubmit={save}>
      <div className="trip-field"><label htmlFor="expense-title">What was it for?</label><Input id="expense-title" placeholder="e.g. Dinner at the lake" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={70} required /></div>
      <div className="grid grid-cols-2 gap-3">
        <div className="trip-field"><label htmlFor="expense-amount">Amount (₹)</label><Input id="expense-amount" inputMode="decimal" type="number" min="0.01" step="0.01" placeholder="0.00" value={amount} onChange={(event) => setAmount(event.target.value)} required /></div>
        <div className="trip-field"><label htmlFor="expense-date">Date</label><Input id="expense-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} required /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="trip-field"><label htmlFor="expense-category">Category</label><select className="trip-select" id="expense-category" value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></div>
        <div className="trip-field"><label htmlFor="expense-payer">Paid by</label><select className="trip-select" id="expense-payer" value={paidByUserId} onChange={(event) => setPaidByUserId(event.target.value)}>{users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</select></div>
      </div>
      <div className="flex gap-2">
        <Input aria-label="New category name" placeholder="Add a category" value={newCategoryName} onChange={(event) => setNewCategoryName(event.target.value)} maxLength={30} />
        <Button type="button" variant="outline" onClick={createCategory} disabled={!newCategoryName.trim()}><Plus size={15} /><span className="sr-only">Add category</span></Button>
      </div>
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-sm font-bold">Split between</p><p className="trip-muted text-xs">Choose individual travellers</p></div>
          <div className="flex gap-1.5"><Button size="sm" variant="outline" type="button" onClick={() => setSelected(users.map((user) => user.id))}>Select all</Button><Button size="sm" variant="ghost" type="button" onClick={() => setSelected([])}>Clear</Button></div>
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
      <Button className="h-11 w-full" type="submit">{initial ? "Review changes" : "Review expense"}</Button>
    </form>
  );
}

function TripExpenseApp() {
  const data = useLocalDemoData();
  const { families, setFamilies, users, setUsers, trips, setTrips, tripUsers, setTripUsers, transactions, setTransactions, categories, setCategories } = data;
  const [page, setPage] = useState<Page>("dashboard");
  const [userTab, setUserTab] = useState<UserTab>("users");
  const [activeTripId, setActiveTripId] = useState("trip-coorg");
  const [tripPickerOpen, setTripPickerOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [notifications, setNotifications] = useState(seedNotifications);
  const [confirmed, setConfirmed] = useState<ConfirmDetails>(null);
  const [expenseDialog, setExpenseDialog] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [tripDialog, setTripDialog] = useState(false);
  const [familyDialog, setFamilyDialog] = useState(false);
  const [userDialog, setUserDialog] = useState(false);
  const [editingUser, setEditingUser] = useState<TripUser | null>(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [loginVisible, setLoginVisible] = useState(false);
  const [mobile, setMobile] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [loginError, setLoginError] = useState("");
  const [tripName, setTripName] = useState("");
  const [tripDate, setTripDate] = useState("2026-11-10");
  const [tripEndDate, setTripEndDate] = useState("");
  const [tripFamilyIds, setTripFamilyIds] = useState<string[]>([]);
  const [tripMemberIds, setTripMemberIds] = useState<string[]>([]);
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
  const myUser = users.find((user) => user.id === "user-raj") ?? users[0];

  const confirm = (action: () => void, message: string, title = "Are you sure?") => setConfirmed({ title, message, action });
  const openExpense = (transaction: Transaction | null = null) => {
    setEditingTransaction(transaction);
    setExpenseDialog(true);
  };
  const saveExpense = (input: Omit<Transaction, "id" | "tripId">) => {
    const expense: Transaction = editingTransaction
      ? { ...editingTransaction, ...input }
      : { ...input, id: `tx-${Date.now()}`, tripId: activeTrip?.id ?? "trip-coorg" };
    setTransactions((items) => editingTransaction ? items.map((item) => item.id === expense.id ? expense : item) : [expense, ...items]);
    setNotifications((items) => [{ id: `note-${Date.now()}`, text: `${myUser?.name ?? "You"} ${editingTransaction ? "updated" : "added"} ${expense.title}`, time: "Just now", unread: true }, ...items]);
    setExpenseDialog(false);
    toast.success(editingTransaction ? "Expense updated" : "Expense added");
  };
  const confirmDelete = (transaction: Transaction) => confirm(() => {
    setTransactions((items) => items.filter((item) => item.id !== transaction.id));
    toast.success("Expense removed");
  }, `Remove “${transaction.title}” from this trip?`, "Delete expense?");
  const addCategory = (name: string) => {
    const existing = categories.find((category) => category.name.toLowerCase() === name.toLowerCase());
    if (existing) return existing;
    const category = { id: `category-${Date.now()}`, name };
    setCategories((items) => [...items, category]);
    return category;
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
  const matchingTransactions = useMemo(() => {
    const term = search.trim().toLowerCase();
    return tripTransactions.filter((transaction) => {
      const matchesText = !term || transaction.title.toLowerCase().includes(term) || transaction.remark?.toLowerCase().includes(term);
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
  const saveTrip = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!tripName.trim() || !tripFamilyIds.length || !tripMemberIds.length) { toast.error("Add a trip name, a family, and at least one traveller."); return; }
    confirm(() => {
      const trip: Trip = { id: `trip-${Date.now()}`, name: tripName.trim(), date: tripDate, ...(tripEndDate ? { endDate: tripEndDate } : {}), adminUserId: myUser?.id ?? "user-raj", familyIds: tripFamilyIds };
      setTrips((items) => [trip, ...items]);
      setTripUsers((items) => ({ ...items, [trip.id]: tripMemberIds }));
      setActiveTripId(trip.id);
      setTripName(""); setTripFamilyIds([]); setTripMemberIds([]); setTripEndDate(""); setTripDialog(false); setPage("dashboard");
      toast.success("Trip created");
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
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userEmail)) { toast.error("Enter a valid email address."); return; }
    if (users.some((user) => user.mobile === normalizedMobile && user.id !== editingUser?.id)) { toast.error("That mobile number is already in use."); return; }
    confirm(() => {
      const saved: TripUser = { id: editingUser?.id ?? `user-${Date.now()}`, name: userName.trim(), mobile: normalizedMobile, email: userEmail.trim(), familyId: userFamilyId };
      setUsers((items) => editingUser ? items.map((user) => user.id === saved.id ? saved : user) : [...items, saved]);
      if (!editingUser && activeTrip) setTripUsers((items) => ({ ...items, [activeTrip.id]: [...new Set([...(items[activeTrip.id] ?? []), saved.id])] }));
      setUserDialog(false);
      toast.success(editingUser ? "Member details updated" : "Member added");
    }, `${editingUser ? "Save changes for" : "Add"} ${userName.trim()}?`);
  };

  const addFamily = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!newFamilyName.trim()) return;
    if (families.some((family) => family.name.toLowerCase() === newFamilyName.trim().toLowerCase())) { toast.error("That family name already exists."); return; }
    confirm(() => {
      const family = { id: `fam-${Date.now()}`, name: newFamilyName.trim(), headUserId: myUser?.id ?? "user-raj" };
      setFamilies((items) => [...items, family]);
      setUserFamilyId(family.id);
      setNewFamilyName(""); setFamilyDialog(false); toast.success("Family added");
    }, `Create “${newFamilyName.trim()}”?`);
  };

  const toggleNotification = (id: string) => setNotifications((items) => items.map((item) => item.id === id ? { ...item, unread: false } : item));

  if (loginVisible) {
    return <div className="trip-app-shell flex min-h-svh flex-col justify-center px-6 py-10">
      <Toaster position="top-center" richColors />
      <div className="mx-auto w-full max-w-sm space-y-8">
        <div className="text-center"><img src={sunshineLogo.url} alt="SunShine Infotech" className="mx-auto h-12 w-auto" /><p className="trip-muted mt-8 text-sm">Good trips start together</p><h1 className="mt-2 text-2xl font-extrabold">Welcome back</h1></div>
        <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); setLoginError(""); if (mobile.replace(/\D/g, "").length !== 10) { setLoginError("Enter your 10-digit mobile number."); return; } if (!users.some((user) => user.mobile === mobile.replace(/\D/g, ""))) { setLoginError("User not registered"); return; } setOtpSent(true); toast.success("Your demo OTP is the last four digits of your mobile."); }}>
          <div className="trip-field"><label htmlFor="login-mobile">Mobile number</label><Input id="login-mobile" type="tel" inputMode="numeric" autoComplete="tel" placeholder="10-digit mobile number" value={mobile} onChange={(event) => setMobile(event.target.value.replace(/\D/g, "").slice(0, 10))} /></div>
          {otpSent ? <div className="trip-field"><label htmlFor="login-otp">4-digit OTP</label><Input id="login-otp" inputMode="numeric" placeholder="Enter OTP" value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 4))} /></div> : null}
          {loginError ? <p className="trip-negative text-sm" role="alert">{loginError}</p> : null}
          <Button className="h-12 w-full" type={otpSent ? "button" : "submit"} onClick={otpSent ? () => { const registered = users.find((user) => user.mobile === mobile); if (!registered) { setLoginError("User not registered"); return; } if (otp !== mobile.slice(-4)) { setLoginError("That OTP doesn't match. Try again."); return; } setLoginVisible(false); setOtpSent(false); setOtp(""); toast.success(`Welcome, ${registered.name.split(" ")[0]}!`); } : undefined}>{otpSent ? "Verify & log in" : "Send OTP"}</Button>
        </form>
        <Button variant="ghost" className="w-full" onClick={() => { setLoginVisible(false); setOtpSent(false); }}>Back to trip overview</Button>
      </div>
    </div>;
  }

  const heading = {
    trips: { title: "Your trips", description: "Shared adventures, all together." },
    transactions: { title: "Expenses", description: "Every shared cost, in one place." },
    dashboard: { title: "Trip overview", description: "" },
    users: { title: "Your people", description: "The families making this trip." },
    profile: { title: "Your profile", description: "Your traveller details." },
  }[page];

  return (
    <div className="trip-app-shell">
      <Toaster position="top-center" richColors />
      <header className="trip-header">
        <div className="flex h-[4.1rem] items-center justify-between gap-3 px-4">
          <img src={sunshineLogo.url} alt="SunShine Infotech" className="h-8 w-auto max-w-[8.5rem] object-contain object-left" onError={(event) => { event.currentTarget.style.display = "none"; }} />
          <button type="button" className="flex min-w-0 items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-2 text-left" onClick={() => setTripPickerOpen(true)} aria-label="Choose trip">
            <MapPin size={14} className="shrink-0 text-primary" /><span className="max-w-36 truncate text-xs font-bold">{activeTrip?.name ?? "Choose a trip"}</span><ChevronDown size={14} className="trip-muted shrink-0" />
          </button>
          <Button variant="ghost" size="icon" className="relative shrink-0" aria-label="Notifications" onClick={() => setNotificationOpen(true)}>
            <Bell size={19} />{unreadCount ? <span className="absolute right-1 top-1 size-2 rounded-full bg-primary ring-2 ring-background" /> : null}
          </Button>
        </div>
      </header>

      <main className="trip-main">
        {page !== "dashboard" ? <div className="mb-5"><p className="trip-muted text-sm">{heading.description}</p><h1 className="trip-page-title mt-1">{heading.title}</h1></div> : null}

        {page === "dashboard" && activeTrip ? <Dashboard trip={activeTrip} families={families} users={activeUsers} transactions={tripTransactions} onShare={shareSummary} /> : null}

        {page === "trips" ? <div className="space-y-4">
          <div className="flex items-center justify-between gap-2"><p className="trip-muted text-sm">{trips.length} {trips.length === 1 ? "trip" : "trips"}</p><Button onClick={() => setTripDialog(true)}><Plus size={16} />New trip</Button></div>
          {trips.map((trip) => {
            const memberIds = tripUsers[trip.id] ?? [];
            const memberList = users.filter((user) => memberIds.includes(user.id));
            const expenseTotal = transactions.filter((transaction) => transaction.tripId === trip.id).reduce((sum, item) => sum + item.amount, 0);
            const isCurrent = trip.id === activeTrip?.id;
            return <button type="button" key={trip.id} onClick={() => { setActiveTripId(trip.id); setPage("dashboard"); }} className={`trip-panel block w-full p-4 text-left ${isCurrent ? "border-primary/50" : ""}`}>
              <div className="flex items-start justify-between gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-lg bg-warm text-primary"><Compass size={20} /></span><span className="trip-chip">{isCurrent ? <Check size={12} /> : <ChevronRight size={13} />}{isCurrent ? "Current trip" : "Open trip"}</span></div>
              <h2 className="mt-4 text-lg font-extrabold">{trip.name}</h2><p className="trip-muted mt-1 flex items-center gap-1.5 text-xs"><CalendarDays size={13} />{formatDate(trip.date)}{trip.endDate ? ` – ${formatDate(trip.endDate)}` : ""}</p>
              <div className="mt-4 flex items-center justify-between gap-2 border-t border-border pt-3"><div className="flex -space-x-2">{memberList.slice(0, 4).map((member) => <span key={member.id} title={member.name} className="trip-avatar size-7 border-2 border-card text-[.58rem]">{initials(member.name)}</span>)}{memberList.length > 4 ? <span className="grid size-7 place-items-center rounded-full border-2 border-card bg-muted text-[.58rem] font-bold">+{memberList.length - 4}</span> : null}</div><div className="text-right"><p className="text-sm font-bold">{formatRupees(expenseTotal)}</p><p className="trip-muted text-[.68rem]">{trip.familyIds.length} families · {memberIds.length} people</p></div></div>
            </button>;
          })}
          <div className="trip-warm flex items-start gap-3 rounded-lg p-4"><Sparkles size={18} className="mt-0.5 shrink-0 text-primary" /><div><p className="text-sm font-bold">A trip together, made simpler</p><p className="trip-muted mt-1 text-xs leading-relaxed">Add the shared costs as they happen. Every family can see their balance settle along the way.</p></div></div>
        </div> : null}

        {page === "transactions" ? <div className="space-y-4">
          <div className="flex items-center justify-between gap-2"><p className="trip-muted text-sm">{matchingTransactions.length} expenses</p><Button onClick={() => openExpense()}><Plus size={16} />Add expense</Button></div>
          <div className="space-y-2"><div className="relative"><Search size={16} className="trip-muted absolute left-3 top-1/2 -translate-y-1/2" /><Input className="trip-search pl-9" placeholder="Search expenses" value={search} onChange={(event) => setSearch(event.target.value)} aria-label="Search expenses" /></div>
            <div className="grid grid-cols-2 gap-2"><label className="trip-muted flex items-center gap-2 rounded-md border border-border bg-card px-2.5 text-xs"><Filter size={14} /><select aria-label="Filter by category" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className="h-10 min-w-0 flex-1 bg-transparent text-foreground outline-none"><option value="all">All categories</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label><label className="trip-muted flex items-center gap-2 rounded-md border border-border bg-card px-2.5 text-xs"><SlidersHorizontal size={14} /><select aria-label="Filter by date" value={dateFilter} onChange={(event) => setDateFilter(event.target.value)} className="h-10 min-w-0 flex-1 bg-transparent text-foreground outline-none"><option value="all">All dates</option>{[...new Set(tripTransactions.map((item) => item.date))].sort((a, b) => b.localeCompare(a)).map((date) => <option key={date} value={date}>{formatDate(date)}</option>)}</select></label></div>
          </div>
          {matchingTransactions.length ? [...new Set(matchingTransactions.map((item) => item.date))].map((date) => <section key={date}><p className="trip-muted mb-2 mt-2 text-xs font-bold uppercase">{formatDate(date)}</p><div className="trip-panel divide-y divide-border px-3">{matchingTransactions.filter((item) => item.date === date).map((item) => {
            const payer = users.find((user) => user.id === item.paidByUserId);
            const category = categories.find((entry) => entry.id === item.categoryId)?.name ?? "Other";
            return <article key={item.id} className="flex items-center gap-2.5 py-3"><span className="grid size-10 shrink-0 place-items-center rounded-lg bg-muted text-primary"><CreditCard size={18} /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-1.5"><p className="max-w-full truncate text-sm font-bold">{item.title}</p>{item.updated ? <span className="trip-chip px-1.5 py-0.5 text-[.58rem]">Edited</span> : null}</div><p className="trip-muted mt-1 truncate text-xs">{category} · {payer?.name ?? "Unknown"} paid · {item.splits.length} people</p></div><div className="shrink-0 text-right"><p className="text-sm font-extrabold">{formatRupees(item.amount)}</p><div className="mt-1 flex justify-end gap-0.5"><Button variant="ghost" size="icon" className="size-8" onClick={() => openExpense(item)} aria-label={`Edit ${item.title}`}><Edit2 size={14} /></Button><Button variant="ghost" size="icon" className="size-8 text-destructive" onClick={() => confirmDelete(item)} aria-label={`Delete ${item.title}`}><X size={15} /></Button></div></div></article>;
          })}</div></section>) : <div className="trip-panel flex flex-col items-center px-5 py-12 text-center"><span className="grid size-12 place-items-center rounded-full bg-muted text-muted-foreground"><Search size={20} /></span><h2 className="mt-3 font-bold">No expenses found</h2><p className="trip-muted mt-1 text-sm">Try a different search or add a trip expense.</p><Button className="mt-4" onClick={() => openExpense()}><Plus size={16} />Add expense</Button></div>}
        </div> : null}

        {page === "users" ? <div className="space-y-4">
          <div className="flex gap-1 rounded-lg bg-muted p-1"><Button variant={userTab === "users" ? "default" : "ghost"} className="h-10 flex-1" onClick={() => setUserTab("users")}><UsersRound size={15} />People</Button><Button variant={userTab === "families" ? "default" : "ghost"} className="h-10 flex-1" onClick={() => setUserTab("families")}><Home size={15} />Families</Button></div>
          {userTab === "users" ? <><div className="flex items-center justify-between gap-2"><p className="trip-muted text-sm">{users.length} travellers</p><Button onClick={() => startUserEdit()}><Plus size={16} />Add member</Button></div><div className="relative"><Search size={16} className="trip-muted absolute left-3 top-1/2 -translate-y-1/2" /><Input className="trip-search pl-9" placeholder="Find a person" value={search} onChange={(event) => setSearch(event.target.value)} aria-label="Search people" /></div><div className="trip-panel px-3">{users.filter((user) => `${user.name} ${user.mobile} ${families.find((family) => family.id === user.familyId)?.name ?? ""}`.toLowerCase().includes(search.toLowerCase())).map((user) => <div key={user.id} className="trip-row"><span className="trip-avatar">{initials(user.name)}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{user.name}</p><p className="trip-muted truncate text-xs">{user.mobile} · {families.find((family) => family.id === user.familyId)?.name}</p></div><Button size="icon" variant="ghost" aria-label={`Edit ${user.name}`} onClick={() => startUserEdit(user)}><Edit2 size={15} /></Button></div>)}</div></> : <><div className="flex items-center justify-between gap-2"><p className="trip-muted text-sm">{families.length} families</p><Button onClick={() => setFamilyDialog(true)}><Plus size={16} />Add family</Button></div><div className="space-y-2">{families.map((family) => { const members = users.filter((user) => user.familyId === family.id); const head = users.find((user) => user.id === family.headUserId); const expanded = familyBalancesExpanded.includes(family.id); return <section key={family.id} className="trip-panel overflow-hidden"><button className="flex min-h-16 w-full items-center gap-3 px-3.5 text-left" type="button" aria-expanded={expanded} onClick={() => setFamilyBalancesExpanded((items) => expanded ? items.filter((id) => id !== family.id) : [...items, family.id])}><span className="trip-avatar"><Home size={17} /></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold">{family.name}</span><span className="trip-muted block truncate text-xs">{members.length} members · Head: {head?.name ?? "Not assigned"}</span></span><ChevronDown className={`trip-muted size-4 transition-transform ${expanded ? "rotate-180" : ""}`} /></button>{expanded ? <div className="border-t border-border px-4 py-2">{members.map((user) => <div key={user.id} className="flex items-center gap-2 border-b border-border/70 py-2 last:border-0"><span className="trip-avatar size-7 text-[.6rem]">{initials(user.name)}</span><span className="flex-1 text-xs">{user.name}</span>{user.id === family.headUserId ? <span className="trip-chip">Head</span> : null}<select aria-label={`Move ${user.name} to family`} className="trip-select h-8 max-w-32 text-xs" value={user.familyId} onChange={(event) => { setUsers((items) => items.map((person) => person.id === user.id ? { ...person, familyId: event.target.value } : person)); toast.success(`${user.name}'s family updated`); }}><option value={family.id}>{family.name}</option>{families.filter((entry) => entry.id !== family.id).map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></div>)}</div> : null}</section>; })}</div></>}
        </div> : null}

        {page === "profile" ? <div className="space-y-4"><div className="trip-panel p-5 text-center"><span className="trip-avatar mx-auto size-16 text-lg">{initials(myUser?.name ?? "Raj Sharma")}</span><h2 className="mt-3 text-lg font-extrabold">{myUser?.name ?? "Raj Sharma"}</h2><p className="trip-muted mt-1 text-sm">{myUser?.mobile ?? ""}</p><p className="trip-muted text-sm">{myUser?.email ?? ""}</p><span className="trip-chip mt-3"><ShieldCheck size={13} />Trip administrator</span></div><section className="trip-panel divide-y divide-border px-4"><div className="py-3.5"><p className="trip-muted text-xs">Family</p><p className="mt-1 text-sm font-bold">{families.find((family) => family.id === myUser?.familyId)?.name ?? "—"}</p></div><div className="py-3.5"><p className="trip-muted text-xs">My trips</p><p className="mt-1 text-sm font-bold">{trips.filter((trip) => (tripUsers[trip.id] ?? []).includes(myUser?.id ?? "")).length} active trips</p></div><div className="py-3.5"><p className="trip-muted text-xs">This trip</p><p className="mt-1 text-sm font-bold">{activeTrip?.name ?? "—"}</p></div></section><Button variant="outline" className="h-11 w-full" onClick={() => startUserEdit(myUser ?? null)}><Edit2 size={16} />Edit my details</Button><Button variant="ghost" className="h-11 w-full text-destructive" onClick={() => confirm(() => { setLoginVisible(true); setPage("dashboard"); }, "You can sign in again with your mobile number.", "Log out?")}><LogOut size={16} />Log out</Button><div className="trip-warm flex items-center gap-2 rounded-lg p-3 text-xs"><CircleHelp size={15} /><span>Need help with a trip? Ask the trip administrator.</span></div></div> : null}
      </main>

      <nav className="trip-bottom-nav" aria-label="Main navigation"><div className="trip-bottom-inner">
        {([
          { id: "trips" as const, label: "Trips", icon: Compass },
          { id: "transactions" as const, label: "Expenses", icon: CreditCard },
          { id: "dashboard" as const, label: "Overview", icon: Wallet },
          { id: "users" as const, label: "People", icon: UsersRound },
          { id: "profile" as const, label: "Profile", icon: MoreHorizontal },
        ]).map((item, index) => <button key={item.id} type="button" className="trip-bottom-item" data-active={page === item.id} onClick={() => setPage(item.id)} aria-current={page === item.id ? "page" : undefined}>
          {index === 2 ? <span className="trip-nav-center"><item.icon size={20} /></span> : <item.icon size={19} />}<span className={index === 2 ? "-mt-2" : ""}>{item.label}</span>
        </button>)}
      </div></nav>

      <DemoModal open={tripPickerOpen} onOpenChange={setTripPickerOpen} title="Choose a trip" description="Your expenses and balances follow the selected trip.">
        <div className="space-y-2">{trips.map((trip) => <button key={trip.id} type="button" className={`flex w-full items-center gap-3 rounded-md border p-3 text-left ${activeTrip?.id === trip.id ? "border-primary bg-warm" : "border-border"}`} onClick={() => { setActiveTripId(trip.id); setTripPickerOpen(false); }}><span className="grid size-9 place-items-center rounded-full bg-muted text-primary"><MapPin size={17} /></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold">{trip.name}</span><span className="trip-muted text-xs">{formatDate(trip.date)} · {(tripUsers[trip.id] ?? []).length} travellers</span></span>{activeTrip?.id === trip.id ? <Check size={17} className="text-primary" /> : null}</button>)}<Button className="w-full" variant="outline" onClick={() => { setTripPickerOpen(false); setTripDialog(true); }}><Plus size={15} />Create a trip</Button></div>
      </DemoModal>

      <DemoModal open={notificationOpen} onOpenChange={setNotificationOpen} title="Notifications" description="The latest from your trip group.">
        <div className="divide-y divide-border">{notifications.map((notification) => <button key={notification.id} type="button" onClick={() => toggleNotification(notification.id)} className="flex w-full items-start gap-3 py-3.5 text-left"><span className={`mt-1.5 size-2 shrink-0 rounded-full ${notification.unread ? "bg-primary" : "bg-border"}`} /><span className="min-w-0 flex-1"><span className="block text-sm font-medium">{notification.text}</span><span className="trip-muted mt-1 block text-xs">{notification.time}</span></span>{notification.unread ? <span className="trip-chip">New</span> : null}</button>)}{!notifications.length ? <p className="trip-muted py-8 text-center text-sm">You're all caught up.</p> : null}</div>
      </DemoModal>

      <DemoModal open={expenseDialog} onOpenChange={setExpenseDialog} title={editingTransaction ? "Edit expense" : "Add an expense"} description={activeTrip?.name ?? ""}>
        <ExpenseForm key={editingTransaction?.id ?? "new-expense"} initial={editingTransaction} users={activeUsers} families={families.filter((family) => activeTrip?.familyIds.includes(family.id))} categories={categories} onSave={saveExpense} onConfirm={(action, message) => confirm(() => { action(); }, message)} onAddCategory={addCategory} />
      </DemoModal>

      <DemoModal open={tripDialog} onOpenChange={setTripDialog} title="Plan a trip" description="Start the shared expense list for your group.">
        <form className="space-y-4" onSubmit={saveTrip}>
          <div className="trip-field"><label htmlFor="trip-name">Trip name</label><Input id="trip-name" placeholder="e.g. Summer by the sea" value={tripName} onChange={(event) => setTripName(event.target.value)} required maxLength={60} /></div>
          <div className="grid grid-cols-2 gap-3"><div className="trip-field"><label htmlFor="trip-start">Start date</label><Input id="trip-start" type="date" value={tripDate} onChange={(event) => setTripDate(event.target.value)} required /></div><div className="trip-field"><label htmlFor="trip-end">End date (optional)</label><Input id="trip-end" type="date" value={tripEndDate} min={tripDate} onChange={(event) => setTripEndDate(event.target.value)} /></div></div>
          <div><div className="mb-2 flex items-center justify-between"><p className="text-sm font-bold">Invite families</p><span className="trip-muted text-xs">{tripFamilyIds.length} selected</span></div><div className="max-h-52 space-y-1 overflow-y-auto rounded-md border border-border p-2">{families.map((family) => <label key={family.id} className="flex cursor-pointer items-center gap-3 rounded p-2 hover:bg-muted"><Checkbox checked={tripFamilyIds.includes(family.id)} onCheckedChange={(checked) => changeTripFamilies(family.id, checked === true)} /><span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{family.name}</span><span className="trip-muted text-xs">{users.filter((user) => user.familyId === family.id).map((user) => user.name.split(" ")[0]).join(", ") || "No members yet"}</span></span></label>)}</div></div>
          <div><div className="mb-2 flex items-center justify-between"><p className="text-sm font-bold">Travellers coming</p><Button type="button" size="sm" variant="ghost" onClick={() => setTripMemberIds(users.filter((user) => tripFamilyIds.includes(user.familyId)).map((user) => user.id))}>Select families</Button></div><div className="max-h-40 space-y-1 overflow-y-auto rounded-md border border-border p-2">{users.filter((user) => tripFamilyIds.includes(user.familyId) || tripMemberIds.includes(user.id)).map((user) => <label key={user.id} className="flex items-center gap-3 rounded p-2"><Checkbox checked={tripMemberIds.includes(user.id)} onCheckedChange={(checked) => setTripMemberIds((current) => checked === true ? [...new Set([...current, user.id])] : current.filter((id) => id !== user.id))} /><span className="flex-1 text-sm">{user.name}</span><span className="trip-muted text-xs">{families.find((family) => family.id === user.familyId)?.name}</span></label>)}</div></div>
          <Button className="h-11 w-full" type="submit">Review trip</Button>
        </form>
      </DemoModal>

      <DemoModal open={familyDialog} onOpenChange={setFamilyDialog} title="Add a family" description="Create a family group for your travellers.">
        <form className="space-y-4" onSubmit={addFamily}><div className="trip-field"><label htmlFor="family-name">Family name</label><Input id="family-name" placeholder="e.g. Rao family" value={newFamilyName} onChange={(event) => setNewFamilyName(event.target.value)} maxLength={50} required /></div><Button className="h-11 w-full" type="submit">Review family</Button></form>
      </DemoModal>

      <DemoModal open={userDialog} onOpenChange={setUserDialog} title={editingUser ? "Edit traveller" : "Add a traveller"} description="Keep contact details and family groups up to date.">
        <form className="space-y-4" onSubmit={saveUser}><div className="trip-field"><label htmlFor="user-name">Full name</label><Input id="user-name" autoComplete="name" placeholder="Traveller name" value={userName} onChange={(event) => setUserName(event.target.value)} required maxLength={70} /></div><div className="trip-field"><label htmlFor="user-mobile">Mobile number</label><Input id="user-mobile" autoComplete="tel" inputMode="numeric" placeholder="10-digit number" value={userMobile} onChange={(event) => setUserMobile(event.target.value.replace(/\D/g, "").slice(0, 10))} required /></div><div className="trip-field"><label htmlFor="user-email">Email address</label><Input id="user-email" type="email" autoComplete="email" placeholder="name@example.com" value={userEmail} onChange={(event) => setUserEmail(event.target.value)} required /></div><div className="trip-field"><label htmlFor="user-family">Family</label><select className="trip-select" id="user-family" value={userFamilyId} onChange={(event) => setUserFamilyId(event.target.value)}>{families.map((family) => <option key={family.id} value={family.id}>{family.name} — {users.filter((user) => user.familyId === family.id).map((user) => user.name.split(" ")[0]).join(", ") || "No members"}</option>)}</select></div><div className="trip-warm rounded-md p-3 text-xs">Demo OTP: last four digits of the mobile number.</div><Button className="h-11 w-full" type="submit">Review details</Button></form>
      </DemoModal>

      <ConfirmModal details={confirmed} close={() => setConfirmed(null)} />
    </div>
  );
}

export { TripExpenseApp };