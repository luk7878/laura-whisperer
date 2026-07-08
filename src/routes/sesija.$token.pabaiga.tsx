import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, Loader2, Sparkles, Star, TrendingDown, Users } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/sesija/$token/pabaiga")({
  head: () => ({
    meta: [
      { title: "Sesijos pabaiga" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: EndPage,
});

type Summary = { topic?: string; insight?: string; action?: string; next_step?: string };

function EndPage() {
  const { token } = Route.useParams();
  const [phase, setPhase] = useState<"rating" | "loading" | "done">("rating");
  const [emotionalEnd, setEmotionalEnd] = useState<number>(5);
  const [feedback, setFeedback] = useState("");
  const [rating, setRating] = useState<number>(0);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [phone, setPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [summary, setSummary] = useState<Summary | null>(null);

  async function finish() {
    if (rating === 0) {
      toast.error("Prašome įvertinti sesiją žvaigždutėmis.");
      return;
    }
    setPhase("loading");
    try {
      const res = await fetch("/api/public/clarity/finish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          emotional_end: emotionalEnd,
          feedback: feedback.trim() || null,
          helpfulness_rating: rating,
          phone: phone.trim() || null,
          contact_email: contactEmail.trim() || null,
        }),
      });
      if (!res.ok) throw new Error("Nepavyko užbaigti");
      const data = (await res.json()) as { summary: Summary | null };
      setSummary(data.summary);
      setPhase("done");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Klaida");
      setPhase("rating");
    }
  }

  if (phase === "loading") {
    return (
      <div className="clarity-scope min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-clarity-terra" />
          <p className="mt-4 text-clarity-ink-soft">Ruošiu tavo santrauką…</p>
        </div>
      </div>
    );
  }

  if (phase === "rating") {
    return (
      <div className="clarity-scope min-h-screen flex flex-col">
        <TopBar />
        <div className="flex-1 flex items-center justify-center px-6 py-12">
          <div className="max-w-lg w-full">
            <h1 className="font-clarity-serif text-4xl text-clarity-ink text-center">Prieš užbaigiant</h1>
            <p className="mt-3 text-center text-clarity-ink-soft">Kelios trumpos akimirkos — padės mums ir tau pačiam.</p>

            {/* Emotional load */}
            <div className="mt-10">
              <label className="block text-sm font-medium text-clarity-ink mb-3">Kaip jautiesi dabar? <span className="text-clarity-ink-soft/70 font-normal">(1 – ramu, 10 – sunku)</span></label>
              <div className="flex items-center justify-between text-xs text-clarity-ink-soft mb-2">
                <span>Ramu</span>
                <span className="font-clarity-serif text-3xl text-clarity-terra">{emotionalEnd}</span>
                <span>Sunku</span>
              </div>
              <input type="range" min={1} max={10} value={emotionalEnd} onChange={(e) => setEmotionalEnd(Number(e.target.value))} className="w-full accent-clarity-terra" />
            </div>

            {/* Helpfulness rating */}
            <div className="mt-8">
              <label className="block text-sm font-medium text-clarity-ink mb-3">
                Kiek ši sesija tau padėjo? <span className="text-clarity-terra">*</span>
              </label>
              <div className="flex items-center justify-center gap-2" onMouseLeave={() => setHoverRating(0)}>
                {[1, 2, 3, 4, 5].map((n) => {
                  const active = (hoverRating || rating) >= n;
                  return (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setRating(n)}
                      onMouseEnter={() => setHoverRating(n)}
                      className="p-1 transition-transform hover:scale-110"
                      aria-label={`${n} iš 5`}
                    >
                      <Star className={`h-9 w-9 ${active ? "fill-clarity-terra text-clarity-terra" : "text-clarity-line"}`} />
                    </button>
                  );
                })}
              </div>
              {rating > 0 && (
                <p className="mt-2 text-center text-xs text-clarity-ink-soft">
                  {rating === 1 && "Visai nepadėjo"}
                  {rating === 2 && "Šiek tiek"}
                  {rating === 3 && "Vidutiniškai"}
                  {rating === 4 && "Labai padėjo"}
                  {rating === 5 && "Buvo tai, ko reikėjo"}
                </p>
              )}
            </div>

            {/* Feedback */}
            <div className="mt-8">
              <label className="block text-sm font-medium text-clarity-ink mb-2">Kas buvo naudingiausia? <span className="text-clarity-ink-soft/70 font-normal">(nebūtinai)</span></label>
              <textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} maxLength={1000} rows={3} className="w-full resize-none rounded-xl border border-clarity-line bg-clarity-bg px-4 py-3 text-clarity-ink placeholder:text-clarity-ink-soft/50 focus:outline-none focus:ring-2 focus:ring-clarity-terra/30 focus:border-clarity-terra" placeholder="Kelios eilutės…" />
            </div>

            {/* Contact */}
            <div className="mt-8 rounded-2xl border border-clarity-line bg-clarity-surface/40 p-5">
              <p className="text-sm font-medium text-clarity-ink">Palik kontaktą (nebūtinai)</p>
              <p className="mt-1 text-xs text-clarity-ink-soft">Jei norėtum, kad susisiektume — pasiūlyti tęsti su mentoriumi arba pakviesti į gyvą sesiją.</p>
              <div className="mt-4 space-y-3">
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  maxLength={50}
                  placeholder="Telefonas (+370…)"
                  className="w-full rounded-xl border border-clarity-line bg-clarity-bg px-4 py-2.5 text-sm text-clarity-ink placeholder:text-clarity-ink-soft/50 focus:outline-none focus:ring-2 focus:ring-clarity-terra/30 focus:border-clarity-terra"
                />
                <input
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  maxLength={255}
                  placeholder="Kitas el. paštas (jei skiriasi nuo rezervacijos)"
                  className="w-full rounded-xl border border-clarity-line bg-clarity-bg px-4 py-2.5 text-sm text-clarity-ink placeholder:text-clarity-ink-soft/50 focus:outline-none focus:ring-2 focus:ring-clarity-terra/30 focus:border-clarity-terra"
                />
              </div>
            </div>

            <button onClick={finish} className="mt-8 w-full rounded-full bg-clarity-terra px-8 py-4 text-lg text-white hover:bg-clarity-ink transition-colors">
              Užbaigti sesiją
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <DoneScreen token={token} emotionalEnd={emotionalEnd} summary={summary} />;
}

function DoneScreen({ token, emotionalEnd, summary }: { token: string; emotionalEnd: number; summary: Summary | null }) {
  return (
    <div className="clarity-scope min-h-screen">
      <TopBar />
      <div className="mx-auto max-w-2xl px-6 py-12 space-y-10">
        <div className="text-center">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-clarity-terra/10 text-clarity-terra">
            <Sparkles className="h-6 w-6" />
          </div>
          <h1 className="mt-6 font-clarity-serif text-4xl text-clarity-ink">Ačiū, kad pabuvai su savimi</h1>
          <p className="mt-3 text-clarity-ink-soft">Štai ką pastebėjome per šią sesiją.</p>
        </div>

        {summary && (
          <div className="space-y-4">
            <SummaryCard label="Pagrindinė tema" value={summary.topic} />
            <SummaryCard label="Naujas suvokimas" value={summary.insight} emphasis />
            <SummaryCard label="Vienas veiksmas šiai savaitei" value={summary.action} />
            <SummaryCard label="Kitas žingsnis" value={summary.next_step} />
          </div>
        )}

        <div className="rounded-2xl border border-clarity-line bg-clarity-surface/50 p-6 flex items-center gap-4">
          <TrendingDown className="h-8 w-8 text-clarity-forest shrink-0" />
          <div>
            <p className="text-sm text-clarity-ink-soft">Emocinis krūvis sesijos pabaigoje</p>
            <p className="font-clarity-serif text-2xl text-clarity-ink">{emotionalEnd}/10</p>
          </div>
        </div>

        <CTASection token={token} />
      </div>
    </div>
  );
}

function SummaryCard({ label, value, emphasis }: { label: string; value?: string; emphasis?: boolean }) {
  if (!value) return null;
  return (
    <div className={`rounded-2xl border border-clarity-line p-6 ${emphasis ? "bg-clarity-terra/5" : "bg-clarity-bg"}`}>
      <div className="text-xs uppercase tracking-wider text-clarity-ink-soft/70">{label}</div>
      <p className={`mt-2 leading-relaxed ${emphasis ? "font-clarity-serif text-xl text-clarity-ink" : "text-clarity-ink"}`}>
        {value}
      </p>
    </div>
  );
}

function CTASection({ token }: { token: string }) {
  const [subEmail, setSubEmail] = useState("");
  const [subBusy, setSubBusy] = useState(false);
  const [subDone, setSubDone] = useState(false);
  const [humanDone, setHumanDone] = useState(false);

  async function subscribe(e: React.FormEvent) {
    e.preventDefault();
    setSubBusy(true);
    try {
      await fetch("/api/public/clarity/interest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, wants_subscription: true }),
      });
      setSubDone(true);
    } finally {
      setSubBusy(false);
    }
  }

  async function bookHuman() {
    await fetch("/api/public/clarity/interest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, wants_human_session: true }),
    });
    setHumanDone(true);
  }

  return (
    <div className="space-y-4 pt-4">
      {/* Subscription CTA */}
      <div className="rounded-2xl border-2 border-clarity-terra bg-clarity-bg p-8">
        <div className="flex items-start gap-3">
          <Sparkles className="h-6 w-6 text-clarity-terra shrink-0 mt-1" />
          <div className="flex-1">
            <h3 className="font-clarity-serif text-2xl text-clarity-ink">Tęsk savarankiškai</h3>
            <p className="mt-2 text-clarity-ink-soft leading-relaxed">
              Virtualus mentorius kasdien šalia — tikslai, augimo žurnalas, gilesni pokalbiai.
              <span className="text-clarity-ink font-medium"> 12,99 €/mėn.</span>
            </p>
            {subDone ? (
              <p className="mt-4 text-sm text-clarity-forest">Ačiū — susisieksime, kai atidarysime registraciją.</p>
            ) : (
              <form onSubmit={subscribe} className="mt-4 flex flex-col sm:flex-row gap-2">
                <input
                  required
                  type="email"
                  value={subEmail}
                  onChange={(e) => setSubEmail(e.target.value)}
                  placeholder="tavo@pastas.lt"
                  className="flex-1 rounded-full border border-clarity-line bg-clarity-bg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-clarity-terra/30"
                />
                <button disabled={subBusy} className="rounded-full bg-clarity-terra px-6 py-2.5 text-sm text-white hover:bg-clarity-ink transition-colors disabled:opacity-60 inline-flex items-center gap-1.5 justify-center">
                  {subBusy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Pranešti man <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </form>
            )}
          </div>
        </div>
      </div>

      {/* Human CTA */}
      <div className="rounded-2xl border border-clarity-line bg-clarity-surface/40 p-6">
        <div className="flex items-start gap-3">
          <Users className="h-5 w-5 text-clarity-forest shrink-0 mt-1" />
          <div className="flex-1">
            <h4 className="font-clarity-serif text-lg text-clarity-ink">Nori tęsti su tikru žmogumi?</h4>
            <p className="mt-1 text-sm text-clarity-ink-soft">Giluminė sesija su koučeriu — 60 min pokalbis apie tai, kas iškilo šiandien.</p>
            {humanDone ? (
              <p className="mt-3 text-sm text-clarity-forest">Užklausa gauta. Susisieksime per 24 val.</p>
            ) : (
              <button onClick={bookHuman} className="mt-3 rounded-full border border-clarity-line bg-clarity-bg px-5 py-2 text-sm text-clarity-ink hover:bg-clarity-surface transition-colors">
                Palikti užklausą
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="text-center pt-6">
        <Link to="/" className="text-sm text-clarity-ink-soft hover:text-clarity-ink underline underline-offset-4">
          Grįžti į pradžią
        </Link>
      </div>
    </div>
  );
}

function TopBar() {
  return (
    <nav className="mx-auto flex max-w-2xl items-center justify-between px-6 py-6">
      <Link to="/" className="font-clarity-serif text-lg text-clarity-ink">Aiškumo sesija</Link>
    </nav>
  );
}
