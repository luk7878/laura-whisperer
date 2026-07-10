import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { ArrowLeft, BookOpen, CheckCircle2, Loader2, Send, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/ask/")({
  component: AskIndex,
});

const STARTERS = [
  "Kaip teisingai suformuluoti tikslą?",
  "Kas yra vertybės ir kaip jas atrasti?",
  "Kaip parašyti stiprią afirmaciją?",
  "Padėk susidėlioti planą per 7 gyvenimo sritis",
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
    if (!search.session) return;
    let cancelled = false;
    setContextLoading(true);
    (async () => {
      const [{ data: session, error: sessionError }, { data: entry }] = await Promise.all([
        supabase
          .from("sessions")
          .select("id,title,active_topic,patterns,emotional_start,emotional_end,updated_at")
          .eq("id", search.session)
          .maybeSingle(),
        supabase
          .from("journal_entries")
          .select("summary,patterns")
          .eq("session_id", search.session)
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
      const patterns = [...new Set([...(session.patterns ?? []), ...(entry?.patterns ?? [])])];
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
      <div className="flex-1 overflow-y-auto px-4 md:px-6 py-8">
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
          <Card className="p-8 bg-card/60 backdrop-blur border-dashed">
            <div className="flex items-center gap-3 mb-4">
              <Sparkles className="h-5 w-5 text-primary" />
              <h2 className="font-serif text-xl">Kuo galiu padėti?</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Klausk savo žodžiais. Kiekvienas pokalbis išsaugomas – galėsi grįžti bet kada.
            </p>
            <div className="grid sm:grid-cols-2 gap-2">
              {STARTERS.map((s) => (
                <button
                  key={s}
                  disabled={busy}
                  onClick={() => start(s)}
                  className="text-left text-sm p-3 rounded-lg border bg-background hover:bg-accent transition-colors disabled:opacity-50"
                >
                  {s}
                </button>
              ))}
            </div>
          </Card>
        </div>
      </div>
      <form
        onSubmit={(e) => start(input, e)}
        className="border-t bg-background/95 backdrop-blur p-4"
      >
        <div className="max-w-2xl mx-auto flex gap-2 items-end">
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
            className="resize-none rounded-2xl bg-muted/50 border-muted"
          />
          <Button
            type="submit"
            size="icon"
            disabled={busy || contextLoading || !input.trim()}
            className="rounded-full h-11 w-11 shrink-0"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </form>
    </div>
  );
}
