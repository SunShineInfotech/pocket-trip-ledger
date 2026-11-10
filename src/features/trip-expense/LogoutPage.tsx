import { useEffect } from "react";
import { Compass, LogOut } from "lucide-react";
import { appPath } from "./api";

export function LogoutPage() {
  useEffect(() => {
    const token = window.localStorage.getItem("pocket-trip-ledger:api-token");
    if (token) {
      const apiBase = (import.meta.env.VITE_POCKET_API_URL ?? "https://sunshineproduct.in/trip/v1_api").replace(/\/+$/, "");
      void fetch(`${apiBase}/auth.php`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ type: 4 }),
      }).catch(() => undefined);
    }
    window.localStorage.removeItem("pocket-trip-ledger:api-token");
    window.localStorage.removeItem("pocket-trip-ledger:logged-in");
    window.localStorage.removeItem("pocket-trip-ledger:session-user-id");
    const timeout = window.setTimeout(() => window.location.replace(appPath("/")), 5000);
    return () => window.clearTimeout(timeout);
  }, []);

  return (
    <main className="trip-login-loader">
      <span className="trip-avatar size-14"><Compass size={25} /></span>
      <span className="trip-loader-ring mt-6" />
      <p className="mt-5 text-xl font-extrabold">Signing you out</p>
      <p className="trip-muted mt-2 text-sm">Your trip data is saved. Returning to sign in…</p>
      <div className="trip-logout-progress"><span /></div>
      <div className="trip-chip mt-5"><LogOut size={13} />Secure sign out</div>
    </main>
  );
}
