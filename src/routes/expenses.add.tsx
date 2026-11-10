import { createFileRoute } from "@tanstack/react-router";
import { TripExpenseApp } from "@/features/trip-expense/TripExpenseApp";

export const Route = createFileRoute("/expenses/add")({ component: () => <TripExpenseApp initialPage="expense" /> });
