export type SettlementUser = { id: string; familyId: string; name: string };
export type SettlementFamily = { id: string; name: string };
export type ExpenseSplit = { userId: string; shareAmount: number };
export type SettlementExpense = {
  amount: number;
  paidByUserId: string;
  date: string;
  splits: ExpenseSplit[];
};

export type PersonBalance = {
  userId: string;
  name: string;
  paid: number;
  consumed: number;
  net: number;
};

export type FamilyBalance = {
  familyId: string;
  name: string;
  paid: number;
  consumed: number;
  net: number;
  members: PersonBalance[];
};

export type FamilySettlement = {
  fromFamilyId: string;
  fromFamilyName: string;
  toFamilyId: string;
  toFamilyName: string;
  amount: number;
};

const toCents = (value: number) => Math.round((value + Number.EPSILON) * 100);
const fromCents = (value: number) => Number((value / 100).toFixed(2));

export function splitAmount(amount: number, userIds: string[]): ExpenseSplit[] {
  const ids = [...new Set(userIds)];
  if (!ids.length || !Number.isFinite(amount) || amount <= 0) return [];
  const total = toCents(amount);
  const base = Math.floor(total / ids.length);
  let remainder = total - base * ids.length;
  return ids.map((userId) => {
    const cents = base + (remainder > 0 ? 1 : 0);
    remainder -= remainder > 0 ? 1 : 0;
    return { userId, shareAmount: fromCents(cents) };
  });
}

export function calculateSettlement(
  families: SettlementFamily[],
  users: SettlementUser[],
  expenses: SettlementExpense[],
  throughDate?: string,
) {
  const included = throughDate ? expenses.filter((expense) => expense.date <= throughDate) : expenses;
  const people = new Map<string, { paid: number; consumed: number }>();
  for (const user of users) people.set(user.id, { paid: 0, consumed: 0 });

  for (const expense of included) {
    const payer = people.get(expense.paidByUserId);
    if (payer) payer.paid += toCents(expense.amount);
    for (const split of expense.splits) {
      const person = people.get(split.userId);
      if (person) person.consumed += toCents(split.shareAmount);
    }
  }

  const personBalances: PersonBalance[] = users.map((user) => {
    const totals = people.get(user.id) ?? { paid: 0, consumed: 0 };
    return {
      userId: user.id,
      name: user.name,
      paid: fromCents(totals.paid),
      consumed: fromCents(totals.consumed),
      net: fromCents(totals.paid - totals.consumed),
    };
  });

  const familiesWithBalances: FamilyBalance[] = families.map((family) => {
    const members = personBalances.filter(
      (person) => users.find((user) => user.id === person.userId)?.familyId === family.id,
    );
    const paidCents = members.reduce((sum, person) => sum + toCents(person.paid), 0);
    const consumedCents = members.reduce((sum, person) => sum + toCents(person.consumed), 0);
    return {
      familyId: family.id,
      name: family.name,
      paid: fromCents(paidCents),
      consumed: fromCents(consumedCents),
      net: fromCents(paidCents - consumedCents),
      members,
    };
  });

  const debtors = familiesWithBalances
    .filter((family) => family.net < 0)
    .map((family) => ({ id: family.familyId, name: family.name, cents: -toCents(family.net) }))
    .sort((a, b) => b.cents - a.cents);
  const creditors = familiesWithBalances
    .filter((family) => family.net > 0)
    .map((family) => ({ id: family.familyId, name: family.name, cents: toCents(family.net) }))
    .sort((a, b) => b.cents - a.cents);

  const settlements: FamilySettlement[] = [];
  let debtorIndex = 0;
  let creditorIndex = 0;
  while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
    const debtor = debtors[debtorIndex];
    const creditor = creditors[creditorIndex];
    if (!debtor || !creditor) break;
    const amountCents = Math.min(debtor.cents, creditor.cents);
    if (amountCents > 0) {
      settlements.push({
        fromFamilyId: debtor.id,
        fromFamilyName: debtor.name,
        toFamilyId: creditor.id,
        toFamilyName: creditor.name,
        amount: fromCents(amountCents),
      });
      debtor.cents -= amountCents;
      creditor.cents -= amountCents;
    }
    if (debtor.cents === 0) debtorIndex += 1;
    if (creditor.cents === 0) creditorIndex += 1;
  }

  const netTotalCents = familiesWithBalances.reduce((sum, family) => sum + toCents(family.net), 0);
  return {
    families: familiesWithBalances,
    people: personBalances,
    settlements,
    isBalanced: netTotalCents === 0,
    totalPaid: fromCents(included.reduce((sum, expense) => sum + toCents(expense.amount), 0)),
  };
}