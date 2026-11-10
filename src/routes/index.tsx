import { createFileRoute } from "@tanstack/react-router";
import { TripExpenseApp } from "@/features/trip-expense/TripExpenseApp";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sunshine Infotech Trip Management" },
      {
        name: "description",
        content: "Keep group trip expenses and family settlements in one place.",
      },
      { property: "og:title", content: "Sunshine Infotech Trip Management" },
      {
        property: "og:description",
        content: "A clear shared view of trip spending, family balances, and settlements.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return <TripExpenseApp />;
}
