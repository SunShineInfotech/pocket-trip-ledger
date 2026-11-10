import { describe, expect, it } from "vitest";
import { calculateSettlement, splitAmount, type SettlementExpense } from "@/lib/settlement";

describe("trip settlement", () => {
  it("balances a sample with five families and 28 members", () => {
    const familyGroups = [6, 6, 6, 5, 5];
    let memberIndex = 0;
    const sampleFamilies = familyGroups.map((_, index) => ({ id: `family-${index}`, name: `Family ${index + 1}` }));
    const sampleUsers = familyGroups.flatMap((count, familyIndex) =>
      Array.from({ length: count }, (_, index) => {
        const user = { id: `member-${memberIndex}`, name: `Member ${memberIndex + 1}`, familyId: `family-${familyIndex}` };
        memberIndex += 1;
        return user;
      }),
    );
    const oneExpense: SettlementExpense = {
      amount: 28,
      paidByUserId: "member-0",
      date: "2026-11-10",
      splits: splitAmount(28, sampleUsers.map((user) => user.id)),
    };
    const result = calculateSettlement(sampleFamilies, sampleUsers, [oneExpense]);
    expect(sampleUsers).toHaveLength(28);
    expect(result.families).toHaveLength(5);
    expect(result.isBalanced).toBe(true);
    expect(result.settlements.reduce((sum, item) => sum + item.amount, 0)).toBe(22);
    expect(result.settlements).toHaveLength(4);
  });

  it("assigns rounding paise to the first selected person", () => {
    const splits = splitAmount(100, ["one", "two", "three"]);
    expect(splits.map((split) => split.shareAmount)).toEqual([33.34, 33.33, 33.33]);
    expect(splits.reduce((sum, split) => sum + Math.round(split.shareAmount * 100), 0)).toBe(10000);
  });

  it("returns zero totals for an empty trip", () => {
    const result = calculateSettlement([{ id: "family-a", name: "Family A" }], [], []);
    expect(result.totalPaid).toBe(0);
    expect(result.families[0]?.net).toBe(0);
    expect(result.settlements).toEqual([]);
    expect(result.isBalanced).toBe(true);
  });

  it("does not create transfers when one family shares all expenses", () => {
    const oneFamily = [{ id: "family-a", name: "Family A" }];
    const oneFamilyUsers = [
      { id: "one", name: "One", familyId: "family-a" },
      { id: "two", name: "Two", familyId: "family-a" },
    ];
    const expense: SettlementExpense = {
      amount: 90,
      paidByUserId: "one",
      date: "2026-11-10",
      splits: splitAmount(90, ["one", "two"]),
    };
    const result = calculateSettlement(oneFamily, oneFamilyUsers, [expense]);
    expect(result.families[0]?.net).toBe(0);
    expect(result.settlements).toEqual([]);
    expect(result.isBalanced).toBe(true);
  });
});