import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import {
  ArrowLeft,
  BookOpen,
  Brain,
  CheckCircle2,
  Compass,
  Lightbulb,
  ListChecks,
  Loader2,
  Send,
  Sparkles,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/ask/")({
  component: AskIndex,
});

const STARTERS = [
  {
    icon: Compass,
    label: "Išgryninti kryptį",
    text: "Padėk man išsigryninti, ko iš tikrųjų noriu šiuo gyvenimo etapu.",
  },
  {
    icon: Brain,
    label: "Suprasti save",
    text: "Padėk pastebėti, koks vidinis modelis šiuo metu mane labiausiai stabdo.",
  },
  {
    icon: ListChecks,
    label: "Susidėlioti veiksmus",
    text: "Turiu tikslą, bet nežinau nuo ko pradėti. Padėk sudaryti realų pirmųjų žingsnių planą.",
  },
  {
    icon: Lightbulb,
    label: "Pažiūrėti kitu kampu",
    text: "Padėk kritiškai ir iš kelių pusių pažvelgti į situaciją, kurią aprašysiu.",
  },
];

function AskIndex() {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { session?: string };
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [contextLoading, setContextLoading] = useState(false);
  const [contextTitle, setContextTitle] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const sessionId = search.session;
    if (!sessionId) return;
    let cancelled = false;
    setContextLoading(true);
    (async () => {
      const [{ data: session, error: sessionError }, { data: entry }] = await Promise.all([
        supabase
          .from("sessions")
          .select("id,title,active_topic,patterns,emotional_start,emotional_end,updated_at")
          .eq("id", sessionId)
          .maybeSingle(),
        supabase
          .from("journal_entries")
          .select("summary,patterns")
          .eq("session_id", sessionId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      if (cancelled) return;
      if (sessionError || !session) {
        toast.error("Nepavyko įkelti pasirinktos sesijos konteksto");
        setContextLoading(false);
        return;
      }
      const sessionPatterns = Array.isArray(session.patterns) ? (session.patterns as string[]) : [];
      const entryPatterns = Array.isArray(entry?.patterns) ? (entry?.patterns as string[]) : [];
      const patterns = [...new Set([...sessionPatterns, ...entryPatterns])];
      const delta =
        session.emotional_start != null && session.emotional_end != null
          ? session.emotional_end - session.emotional_start
          : null;
      const context = [
        "Noriu su tavimi aptarti ankstesnę mano augimo sesiją.",
        "",
        `Sesijos pavadinimas: ${session.title}`,
        session.active_topic ? `Tema: ${session.active_topic}` : null,
        entry?.summary ? `Sesijos santrauka: ${entry.summary}` : null,
        patterns.length ? `Pastebėti modeliai: ${patterns.join(", ")}` : null,
        delta != null
          ? `Emocinis pokytis: nuo ${session.emotional_start} iki ${session.emotional_end} (${delta < 0 ? `${Math.abs(delta)} bal. lengviau` : delta > 0 ? `+${delta} bal.` : "be pokyčio"}).`
          : null,
        "",
        "Padėk man giliau suprasti šią sesiją. Pirmiausia trumpai įvardyk svarbiausią matomą kryptį, tada užduok vieną klausimą, kuris padėtų nuspręsti, ką verta aptarti toliau.",
      ]
        .filter(Boolean)
        .join("\n");
      setContextTitle(session.title);
      setInput(context);
      setContextLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    })();
    return () => {
      cancelled = true;
    };
  }, [search.session]);

  async function start(text: string, e?: FormEvent) {
    e?.preventDefault();
    const q = text.trim();
    if (!q || busy) return;
    setBusy(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Nesi prisijungęs");
      const title = q.slice(0, 60);
      const { data: thread, error: tErr } = await supabase
        .from("mentor_threads")
        .insert({ user_id: userData.user.id, title })
        .select("id")
        .single();
      if (tErr || !thread) throw new Error(tErr?.message ?? "Nepavyko sukurti pokalbio");
      const { error: mErr } = await supabase.from("mentor_messages").insert({
        thread_id: thread.id,
        user_id: userData.user.id,
        role: "user",
        content: q,
      });
      if (mErr) throw new Error(mErr.message);
      navigate({ to: "/ask/$threadId", params: { threadId: thread.id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Klaida");
      setBusy(false);
    }
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="flex-1 overflow-y-auto px-4 py-8 md:px-8 md:py-12">
        <div className="max-w-2xl mx-auto">
          {contextLoading && (
            <Card className="mb-4 flex items-center gap-3 p-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Ruošiamas sesijos kontekstas…
            </Card>
          )}
          {contextTitle && !contextLoading && (
            <Card className="mb-4 overflow-hidden border-primary/20 bg-primary/[0.04]">
              <div className="flex items-start gap-3 p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <BookOpen className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-primary">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Sesijos kontekstas paruoštas
                  </div>
                  <h2 className="mt-1 truncate font-medium">{contextTitle}</h2>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    Mentoriui bus perduota šios sesijos tema, santrauka, modeliai ir emocinis
                    pokytis. Gali papildyti klausimą apačioje.
                  </p>
                </div>
                <Button asChild variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                  <a href="/journal" aria-label="Grįžti į žurnalą">
                    <ArrowLeft className="h-4 w-4" />
                  </a>
                </Button>
              </div>
            </Card>
          )}
          <Card className="relative overflow-hidden border-primary/15 bg-gradient-to-br from-card via-card to-primary/[0.07] p-6 md:p-8">
            <div className="flex items-center gap-3 mb-4">
              <Sparkles className="h-5 w-5 text-primary" />
              <h2 className="font-serif text-xl">Kuo galiu padėti?</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Klausk savo žodžiais. Kiekvienas pokalbis išsaugomas – galėsi grįžti bet kada.
            </p>
            <div className="grid sm:grid-cols-2 gap-3">
              {STARTERS.map((s) => (
                <button
                  key={s.label}
                  disabled={busy}
                  onClick={() => setInput(s.text)}
                  className="group flex min-h-24 items-start gap-3 rounded-2xl border border-white/80 bg-background/70 p-4 text-left shadow-[0_8px_24px_-22px_oklch(0.25_0.08_270)] transition-all hover:-translate-y-1 hover:border-primary/25 hover:bg-card hover:shadow-[0_16px_34px_-24px_oklch(0.25_0.08_270)] disabled:opacity-50"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <s.icon className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-sm font-medium">{s.label}</div>
                    <div className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                      {s.text}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </Card>
        </div>
      </div>
      <form
        onSubmit={(e) => start(input, e)}
        className="border-t border-border/60 bg-background/80 p-3 backdrop-blur-xl md:p-4"
      >
        <div className="mx-auto flex max-w-3xl items-end gap-2 rounded-2xl border border-white/80 bg-card/95 p-2 shadow-[0_16px_45px_-24px_oklch(0.25_0.08_270_/_0.55)] transition-all focus-within:border-primary/35 focus-within:ring-4 focus-within:ring-primary/8">
          <Textarea
            ref={inputRef}
            autoFocus
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                start(input);
              }
            }}
            placeholder={
              contextTitle
                ? "Papildyk, ką konkrečiai nori aptarti…"
                : "Užduok klausimą savo žinių bazei…"
            }
            rows={contextTitle ? 6 : 2}
            className="min-h-12 resize-none border-0 bg-transparent px-3 py-2 text-base shadow-none focus-visible:ring-0"
          />
          <Button
            type="submit"
            size="icon"
            disabled={busy || contextLoading || !input.trim()}
            className="h-11 w-11 shrink-0 rounded-xl"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </form>
    </div>
  );
}
