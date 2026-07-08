import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/unsubscribe")({
  component: UnsubscribePage,
  head: () => ({
    meta: [
      { title: "Atsisakymas prenumeratos | Laura Borušaitė" },
      { name: "description", content: "Atsisakykite laiškų iš Laura Borušaitė." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

type State =
  | { kind: "loading" }
  | { kind: "invalid" }
  | { kind: "already" }
  | { kind: "confirm"; email: string }
  | { kind: "submitting"; email: string }
  | { kind: "done" }
  | { kind: "error"; message: string };

function UnsubscribePage() {
  const [state, setState] = useState<State>({ kind: "loading" });
  const token =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("token") ?? ""
      : "";

  useEffect(() => {
    if (!token) {
      setState({ kind: "invalid" });
      return;
    }
    (async () => {
      try {
        const res = await fetch(`/email/unsubscribe?token=${encodeURIComponent(token)}`);
        const data = (await res.json()) as {
          valid?: boolean;
          email?: string;
          reason?: string;
        };
        if (data.valid && data.email) {
          setState({ kind: "confirm", email: data.email });
        } else if (data.reason === "already_unsubscribed") {
          setState({ kind: "already" });
        } else {
          setState({ kind: "invalid" });
        }
      } catch {
        setState({ kind: "error", message: "Nepavyko patikrinti nuorodos." });
      }
    })();
  }, [token]);

  async function confirm(email: string) {
    setState({ kind: "submitting", email });
    try {
      const res = await fetch("/email/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = (await res.json()) as { success?: boolean; reason?: string };
      if (data.success) setState({ kind: "done" });
      else if (data.reason === "already_unsubscribed") setState({ kind: "already" });
      else setState({ kind: "error", message: "Nepavyko atsisakyti." });
    } catch {
      setState({ kind: "error", message: "Tinklo klaida." });
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-background px-6 py-16">
      <div className="max-w-md w-full text-center space-y-6">
        <h1 className="text-2xl font-semibold">Prenumeratos atsisakymas</h1>
        {state.kind === "loading" && <p className="text-muted-foreground">Kraunama…</p>}
        {state.kind === "invalid" && (
          <p className="text-muted-foreground">
            Nuoroda negalioja arba pasibaigė jos galiojimas.
          </p>
        )}
        {state.kind === "already" && (
          <p className="text-muted-foreground">Jūs jau esate atsisakę laiškų. Ačiū.</p>
        )}
        {(state.kind === "confirm" || state.kind === "submitting") && (
          <>
            <p className="text-muted-foreground">
              Ar tikrai norite atsisakyti laiškų adresu{" "}
              <strong>{state.email}</strong>?
            </p>
            <button
              onClick={() => confirm(state.email)}
              disabled={state.kind === "submitting"}
              className="px-6 py-3 rounded-full bg-foreground text-background font-medium disabled:opacity-60"
            >
              {state.kind === "submitting" ? "Vykdoma…" : "Patvirtinti"}
            </button>
          </>
        )}
        {state.kind === "done" && (
          <p className="text-muted-foreground">
            Sėkmingai atsisakėte laiškų. Daugiau jų negausite.
          </p>
        )}
        {state.kind === "error" && <p className="text-destructive">{state.message}</p>}
      </div>
    </main>
  );
}
