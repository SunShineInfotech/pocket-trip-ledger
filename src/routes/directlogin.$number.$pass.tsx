import { createFileRoute } from "@tanstack/react-router";
import { TripExpenseApp } from "@/features/trip-expense/TripExpenseApp";

export const Route = createFileRoute("/directlogin/$number/$pass")({
  component: DirectLogin,
});

function DirectLogin() {
  const { number, pass } = Route.useParams();
  return <TripExpenseApp directLogin={{ number, pass }} />;
}
