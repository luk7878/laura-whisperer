import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Send, Sparkles, Clock, AlertCircle, Phone, X, ChevronRight } from "lucide-react";
import { CRISIS_RESOURCES } from "@/lib/crisis-resources";
import type { SafetyCheck } from "@/lib/clarity-safety";

export const Route = createFileRoute("/sesija/$token/")({
  head: () => ({
    meta: [
      { title: "Aiškumo sesija" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SessionPage,
});

type ChatMsg = { role: "user" | "assistant"; content: string };
const SESSION_MINUTES = 15;

function SessionPage() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const [phase, setPhase] = useState<"intro" | "chat">("intro");
  const [emotionalStart, setEmotionalStart] = useState<number>(5);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [safety, setSafety] = useState<SafetyCheck>({ level: "none", reason: null });
  const [dismissedSafety, setDismissedSafety] = useState(false);
  const [startedAt] = useState(Date.now());
  const [now, setNow] = useState(Date.now());
  const [sessionEnded, setSessionEnded] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);

  function detectClosing(text: string): boolean {
    const t = text.toLowerCase();
    const patterns = [
      "ačiū už pokalbį",
      "sėkmės tau",
      "iki pasimatymo",
      "iki kito karto",
      "gerai užbaigti sesij",
      "užbaigiame sesij",
      "baigiame sesij",
      "užbaikime sesij",
    ];
    return patterns.some((p) => t.includes(p));
  }

  useEffect(() => {
    if (phase !== "chat") return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [phase]);

  const elapsedMs = now - startedAt;
  const remainingSec = Math.max(0, SESSION_MINUTES * 60 - Math.floor(elapsedMs / 1000));
  const progress = Math.min(100, (elapsedMs / (SESSION_MINUTES * 60 * 1000)) * 100);
  const timerLabel = useMemo(() => {
    const m = Math.floor(remainingSec / 60);
    const s = remainingSec % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  }, [remainingSec]);

  useEffect(() => {
    if (phase === "chat" && remainingSec === 0) {
      navigate({ to: "/sesija/$token/pabaiga", params: { token } });
    }
  }, [remainingSec, phase, navigate, token]);

  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function sendMessage(text: string) {
    if (!text.trim() || sending) return;
    const userMsg: ChatMsg = { role: "user", content: text.trim() };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setSending(true);
    try {
      const res = await fetch("/api/public/clarity/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          content: userMsg.content,
          emotional_start: messages.length === 0 ? emotionalStart : null,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as { reply: string; safety: SafetyCheck };
      setMessages((m) => [...m, { role: "assistant", content: data.reply }]);
      if (data.safety.level !== "none") {
        setSafety(data.safety);
        setDismissedSafety(false);
      }
      if (detectClosing(data.reply)) {
        setSessionEnded(true);
      }
    } catch (err) {
      console.error(err);
      setMessages((m) => [
        ...m,
        { role: "assistant", content: "Įvyko klaida. Bandyk dar kartą po kelių sekundžių." },
      ]);
    } finally {
      setSending(false);
    }
  }

  function startChat() {
    setPhase("chat");
    // Send an implicit opener so AI can greet based on emotional state
    setTimeout(() => {
      sendMessage(`Pradedu sesiją. Šiuo metu emocinis krūvis ${emotionalStart}/10.`);
    }, 200);
  }

  if (phase === "intro") {
    return (
      <div className="clarity-scope min-h-screen flex flex-col">
        <MinimalTop />
        <div className="flex-1 flex items-center justify-center px-6 py-12">
          <div className="max-w-lg w-full">
            <h1 className="font-clarity-serif text-4xl text-clarity-ink text-center">
              Prieš pradedant
            </h1>
            <p className="mt-4 text-center text-clarity-ink-soft leading-relaxed">
              Kaip jautiesi šiuo metu, prieš sesiją? Nuo <span className="text-clarity-ink">1</span> (labai ramus) iki <span className="text-clarity-ink">10</span> (labai sunku).
            </p>
            <div className="mt-10">
              <div className="flex items-center justify-between text-xs text-clarity-ink-soft mb-2">
                <span>Ramu</span>
                <span className="font-clarity-serif text-3xl text-clarity-terra">{emotionalStart}</span>
                <span>Sunku</span>
              </div>
              <input
                type="range"
                min={1}
                max={10}
                value={emotionalStart}
                onChange={(e) => setEmotionalStart(Number(e.target.value))}
                className="w-full accent-clarity-terra"
              />
            </div>
            <button
              onClick={startChat}
              className="mt-10 w-full rounded-full bg-clarity-terra px-8 py-4 text-lg text-white hover:bg-clarity-ink transition-colors"
            >
              Pradėti 15 min sesiją
            </button>
            <p className="mt-4 text-center text-xs text-clarity-ink-soft/70">
              Bet kada gali užbaigti anksčiau.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="clarity-scope min-h-screen flex flex-col">
      {/* Timer header */}
      <header className="border-b border-clarity-line bg-clarity-bg/90 backdrop-blur sticky top-0 z-10">
        <div className="mx-auto max-w-2xl px-4 py-3 flex items-center gap-3">
          <Clock className="h-4 w-4 text-clarity-ink-soft" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between text-xs text-clarity-ink-soft mb-1">
              <span>Aiškumo sesija</span>
              <span className="font-medium text-clarity-ink tabular-nums">{timerLabel}</span>
            </div>
            <div className="h-1 rounded-full bg-clarity-surface overflow-hidden">
              <div className="h-full bg-clarity-terra transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>
          <button
            onClick={() => navigate({ to: "/sesija/$token/pabaiga", params: { token } })}
            className="text-xs text-clarity-ink-soft hover:text-clarity-ink transition-colors underline underline-offset-2"
          >
            Užbaigti
          </button>
        </div>
      </header>

      {/* Safety banner */}
      {safety.level !== "none" && !dismissedSafety && (
        <SafetyBanner safety={safety} token={token} onDismiss={() => setDismissedSafety(true)} />
      )}

      {/* Chat */}
      <div ref={scrollerRef} className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl px-4 py-6 space-y-4">
          {messages.length === 0 && (
            <div className="text-center text-clarity-ink-soft/70 text-sm py-8">
              <Sparkles className="h-5 w-5 mx-auto mb-2 text-clarity-terra" />
              Mentorius netrukus atsakys…
            </div>
          )}
          {messages.map((m, i) => (
            <MessageBubble key={i} role={m.role} content={m.content} />
          ))}
          {sending && (
            <div className="flex items-center gap-2 text-clarity-ink-soft/70 text-sm">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Mentorius rašo…
            </div>
          )}
          {sessionEnded && !sending && (
            <div className="mt-6 rounded-2xl border-2 border-clarity-terra bg-clarity-terra/5 p-5 text-center">
              <Sparkles className="h-5 w-5 mx-auto text-clarity-terra" />
              <p className="mt-2 font-clarity-serif text-lg text-clarity-ink">Sesija baigėsi</p>
              <p className="mt-1 text-sm text-clarity-ink-soft">Prieš atsisveikinant — trumpas įvertinimas ir tavo santrauka.</p>
              <button
                onClick={() => navigate({ to: "/sesija/$token/pabaiga", params: { token } })}
                className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-clarity-terra px-6 py-2.5 text-sm text-white hover:bg-clarity-ink transition-colors"
              >
                Įvertinti ir gauti santrauką <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>


      {/* Composer */}
      <form
        onSubmit={(e) => { e.preventDefault(); sendMessage(input); }}
        className="border-t border-clarity-line bg-clarity-bg p-4"
      >
        <div className="mx-auto max-w-2xl flex gap-2 items-end">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
            }}
            rows={2}
            placeholder="Rašyk savais žodžiais…"
            maxLength={2000}
            className="flex-1 resize-none rounded-2xl border border-clarity-line bg-clarity-surface/40 px-4 py-3 text-clarity-ink placeholder:text-clarity-ink-soft/50 focus:outline-none focus:ring-2 focus:ring-clarity-terra/30 focus:border-clarity-terra transition-colors"
            autoFocus
          />
          <button
            type="submit"
            disabled={sending || !input.trim()}
            className="h-11 w-11 shrink-0 rounded-full bg-clarity-terra text-white flex items-center justify-center hover:bg-clarity-ink transition-colors disabled:opacity-50"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
      </form>
    </div>
  );
}

function MessageBubble({ role, content }: { role: "user" | "assistant"; content: string }) {
  if (role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-clarity-terra text-white px-4 py-3 leading-relaxed whitespace-pre-wrap">
          {content}
        </div>
      </div>
    );
  }
  return (
    <div className="flex justify-start">
      <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-clarity-surface border border-clarity-line px-4 py-3 leading-relaxed whitespace-pre-wrap text-clarity-ink">
        {content}
      </div>
    </div>
  );
}

function SafetyBanner({
  safety,
  token,
  onDismiss,
}: {
  safety: SafetyCheck;
  token: string;
  onDismiss: () => void;
}) {
  const [showBooking, setShowBooking] = useState(false);
  return (
    <>
      <div className={`border-b ${safety.level === "crisis" ? "bg-destructive/5 border-destructive/30" : "bg-clarity-surface border-clarity-line"}`}>
        <div className="mx-auto max-w-2xl px-4 py-4">
          <div className="flex items-start gap-3">
            <AlertCircle className={`h-5 w-5 shrink-0 mt-0.5 ${safety.level === "crisis" ? "text-destructive" : "text-clarity-terra"}`} />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-clarity-ink leading-relaxed">
                Atrodo, kad ši tema tau labai jautri. Jei nori, gali pratęsti su žmogumi, kuris padės saugiau.
              </p>
              {safety.level === "crisis" && (
                <div className="mt-3 rounded-lg bg-clarity-bg border border-clarity-line p-3 space-y-1.5">
                  <p className="text-xs font-medium text-clarity-ink">Krizės atveju skambink dabar:</p>
                  {CRISIS_RESOURCES.map((r) => (
                    <div key={r.name} className="flex items-center gap-2 text-xs text-clarity-ink-soft">
                      <Phone className="h-3 w-3" />
                      <span className="text-clarity-ink">{r.name}</span>
                      <a href={`tel:${r.phone.replace(/\s+/g, "")}`} className="font-medium text-clarity-terra">{r.phone}</a>
                      {r.note && <span className="text-clarity-ink-soft/70">· {r.note}</span>}
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  onClick={() => setShowBooking(true)}
                  className="inline-flex items-center gap-1.5 rounded-full bg-clarity-ink text-clarity-bg px-4 py-2 text-xs hover:bg-clarity-terra transition-colors"
                >
                  Rezervuoti sesiją su žmogumi <ChevronRight className="h-3 w-3" />
                </button>
                <button
                  onClick={onDismiss}
                  className="rounded-full border border-clarity-line px-4 py-2 text-xs text-clarity-ink-soft hover:text-clarity-ink transition-colors"
                >
                  Tęsti su AI
                </button>
              </div>
            </div>
            <button onClick={onDismiss} className="text-clarity-ink-soft/60 hover:text-clarity-ink" aria-label="Uždaryti">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
      {showBooking && <HumanBookingDialog token={token} onClose={() => setShowBooking(false)} />}
    </>
  );
}

function HumanBookingDialog({ token, onClose }: { token: string; onClose: () => void }) {
  const [preferredAt, setPreferredAt] = useState(defaultPreferredAt());
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch("/api/public/clarity/interest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          wants_human_session: true,
          human_session_preferred_at: preferredAt ? new Date(preferredAt).toISOString() : null,
          human_session_note: note.trim() || null,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      setDone(true);
    } catch (err) {
      console.error(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-clarity-ink/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl bg-clarity-bg border border-clarity-line shadow-xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {done ? (
          <div className="text-center py-4">
            <Sparkles className="h-6 w-6 mx-auto text-clarity-terra" />
            <h2 className="mt-3 font-clarity-serif text-2xl text-clarity-ink">Rezervacija priimta</h2>
            <p className="mt-2 text-sm text-clarity-ink-soft leading-relaxed">
              Susisieksime el. paštu per artimiausias 24 val., kad patvirtintume laiką.
            </p>
            <button
              onClick={onClose}
              className="mt-6 rounded-full bg-clarity-terra px-6 py-2.5 text-sm text-white hover:bg-clarity-ink transition-colors"
            >
              Uždaryti
            </button>
          </div>
        ) : (
          <form onSubmit={submit}>
            <div className="flex items-start justify-between">
              <h2 className="font-clarity-serif text-2xl text-clarity-ink">Sesija su žmogumi</h2>
              <button type="button" onClick={onClose} aria-label="Uždaryti" className="text-clarity-ink-soft/60 hover:text-clarity-ink">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-2 text-sm text-clarity-ink-soft leading-relaxed">
              Pasirink tau tinkamą laiką. Susisieksime el. paštu, kad patvirtintume ir atsiųstume nuorodą.
            </p>

            <label className="mt-5 block text-sm font-medium text-clarity-ink mb-2">
              Pageidaujamas laikas
            </label>
            <input
              type="datetime-local"
              required
              value={preferredAt}
              onChange={(e) => setPreferredAt(e.target.value)}
              min={minPreferredAt()}
              className="w-full rounded-xl border border-clarity-line bg-clarity-bg px-4 py-3 text-clarity-ink focus:outline-none focus:ring-2 focus:ring-clarity-terra/30 focus:border-clarity-terra transition-colors"
            />

            <label className="mt-4 block text-sm font-medium text-clarity-ink mb-2">
              Pastaba (nebūtinai)
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="Ką norėtum aptarti?"
              className="w-full resize-none rounded-xl border border-clarity-line bg-clarity-bg px-4 py-3 text-clarity-ink placeholder:text-clarity-ink-soft/50 focus:outline-none focus:ring-2 focus:ring-clarity-terra/30 focus:border-clarity-terra transition-colors"
            />

            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-full border border-clarity-line px-5 py-2.5 text-sm text-clarity-ink-soft hover:text-clarity-ink transition-colors"
              >
                Atšaukti
              </button>
              <button
                type="submit"
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-full bg-clarity-terra px-6 py-2.5 text-sm text-white hover:bg-clarity-ink transition-colors disabled:opacity-60"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Rezervuoti
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function defaultPreferredAt() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(18, 0, 0, 0);
  return toLocalInput(d);
}

function minPreferredAt() {
  const d = new Date();
  d.setHours(d.getHours() + 2);
  return toLocalInput(d);
}

function toLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function MinimalTop() {
  return (
    <nav className="mx-auto flex max-w-2xl items-center justify-between px-6 py-6">
      <Link to="/" className="font-clarity-serif text-lg text-clarity-ink">
        Aiškumo sesija
      </Link>
    </nav>
  );
}
