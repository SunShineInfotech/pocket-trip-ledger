import { createFileRoute } from "@tanstack/react-router";
import { LogoutPage } from "@/features/trip-expense/LogoutPage";

export const Route = createFileRoute("/logout")({
  component: LogoutPage,
});
