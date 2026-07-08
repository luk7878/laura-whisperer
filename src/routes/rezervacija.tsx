import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";


export const Route = createFileRoute("/rezervacija")({
  head: () => ({
    meta: [
      { title: "Rezervuoti aiškumo sesiją" },
      { name: "description", content: "Trumpa forma — vardas, el. paštas ir tema. Sesija prasideda per kelias minutes." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: BookingPage,
});

function BookingPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [concern, setConcern] = useState("");
  const [scheduledAt, setScheduledAt] = useState(defaultScheduledAt());
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ token: string } | null>(null);
  const [waitlisted, setWaitlisted] = useState(false);
  const [slots, setSlots] = useState<{ remaining: number; capacity: number } | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("clarity_slot_state")
        .select("capacity, filled")
        .eq("id", 1)
        .maybeSingle();
      if (data) setSlots({ remaining: Math.max(0, data.capacity - data.filled), capacity: data.capacity });
    })();
  }, []);


  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!consent) {
      toast.error("Prašome patvirtinti, kad tai nėra terapija.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/public/clarity/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          concern: concern.trim() || null,
          scheduled_at: scheduledAt ? new Date(scheduledAt).toISOString() : null,
          consent_accepted: consent,
        }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Nepavyko sukurti rezervacijos");
      }
      const data = (await res.json()) as { access_token?: string; waitlisted?: boolean };
      if (data.waitlisted) {
        setWaitlisted(true);
      } else if (data.access_token) {
        setDone({ token: data.access_token });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Klaida");
    } finally {
      setBusy(false);
    }
  }

  if (waitlisted) {
    return (
      <div className="clarity-scope min-h-screen flex flex-col">
        <TopBar />
        <div className="flex-1 flex items-center justify-center px-6 py-16">
          <div className="max-w-lg text-center">
            <h1 className="mt-6 font-clarity-serif text-4xl text-clarity-ink">Esi laukiančiųjų sąraše</h1>
            <p className="mt-4 text-clarity-ink-soft leading-relaxed">
              Šiuo metu visos 30 vietų užimtos. Kai atsilaisvins vieta, parašysime į <span className="text-clarity-ink">{email}</span>.
            </p>
            <Link to="/" className="mt-8 inline-flex items-center gap-2 rounded-full border border-clarity-line px-6 py-3 text-clarity-ink hover:bg-clarity-line/30 transition-colors">
              Grįžti į pradžią
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="clarity-scope min-h-screen flex flex-col">
        <TopBar />
        <div className="flex-1 flex items-center justify-center px-6 py-16">
          <div className="max-w-lg text-center">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-clarity-terra/10 text-clarity-terra">
              <Sparkles className="h-6 w-6" />
            </div>
            <h1 className="mt-6 font-clarity-serif text-4xl text-clarity-ink">Rezervacija patvirtinta</h1>
            <p className="mt-4 text-clarity-ink-soft leading-relaxed">
              Nuoroda į sesiją išsiųsta į <span className="text-clarity-ink">{email}</span>. Gali pradėti dabar arba atėjus pasirinktam laikui.
            </p>
            <button
              onClick={() => navigate({ to: "/sesija/$token", params: { token: done.token } })}
              className="mt-8 inline-flex items-center gap-2 rounded-full bg-clarity-terra px-8 py-4 text-lg text-white hover:bg-clarity-ink transition-colors"
            >
              Pradėti sesiją dabar
            </button>
            <p className="mt-4 text-xs text-clarity-ink-soft/70">Nuoroda išlieka aktyvi 7 dienas.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="clarity-scope min-h-screen">
      <TopBar />
      <div className="mx-auto max-w-xl px-6 py-12">
        <h1 className="font-clarity-serif text-4xl text-clarity-ink">Rezervuoti sesiją</h1>
        <p className="mt-3 text-clarity-ink-soft">15 minučių. Nemokamai. Be paskyros.</p>

        <form onSubmit={submit} className="mt-10 space-y-6">
          <Field label="Vardas">
            <input required maxLength={100} value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="Kaip tave vadinti?" />
          </Field>
          <Field label="El. paštas">
            <input required type="email" maxLength={255} value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} placeholder="tavo@pastas.lt" />
            <p className="mt-1.5 text-xs text-clarity-ink-soft/70">Į jį atsiųsime sesijos nuorodą.</p>
          </Field>
          <Field label="Kas šiuo metu labiausiai slegia? (nebūtinai)">
            <textarea maxLength={1000} rows={4} value={concern} onChange={(e) => setConcern(e.target.value)} className={inputCls + " resize-none"} placeholder="Kelios eilutės savais žodžiais…" />
          </Field>
          <Field label="Pasirinktas laikas">
            <input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} className={inputCls} />
            <p className="mt-1.5 text-xs text-clarity-ink-soft/70">Gali pradėti ir iškart — laikas tik primena, kad tai tavo įsipareigojimas sau.</p>
          </Field>
          <label className="flex items-start gap-3 cursor-pointer">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1 h-4 w-4 rounded border-clarity-line accent-clarity-terra" />
            <span className="text-sm text-clarity-ink-soft leading-relaxed">
              Suprantu, kad tai nėra terapija ar medicininė pagalba. Krizės atveju kreipsiuosi į specialistus.
            </span>
          </label>
          <button disabled={busy} type="submit" className="inline-flex items-center gap-2 rounded-full bg-clarity-terra px-8 py-4 text-lg text-white hover:bg-clarity-ink transition-colors disabled:opacity-60">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Rezervuoti
          </button>
        </form>
      </div>
    </div>
  );
}

const inputCls =
  "w-full rounded-xl border border-clarity-line bg-clarity-bg px-4 py-3 text-clarity-ink placeholder:text-clarity-ink-soft/50 focus:outline-none focus:ring-2 focus:ring-clarity-terra/30 focus:border-clarity-terra transition-colors";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-clarity-ink mb-2">{label}</label>
      {children}
    </div>
  );
}

function TopBar() {
  return (
    <nav className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
      <Link to="/" className="inline-flex items-center gap-2 text-sm text-clarity-ink-soft hover:text-clarity-ink transition-colors">
        <ArrowLeft className="h-4 w-4" /> Grįžti
      </Link>
      <span className="font-clarity-serif text-lg">Aiškumo sesija</span>
    </nav>
  );
}

function defaultScheduledAt() {
  const d = new Date();
  d.setMinutes(d.getMinutes() + 10);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
