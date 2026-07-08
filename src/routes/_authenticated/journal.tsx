import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BookOpen, Search, Calendar, MessageSquare, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/journal")({
  component: JournalPage,
});

type JournalEntry = {
  id: string;
  session_id: string | null;
  summary: string;
  patterns: string[] | null;
  created_at: string;
};

type SessionRow = {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  emotional_start: number | null;
  emotional_current: number | null;
  emotional_end: number | null;
  active_topic: string | null;
  patterns: string[] | null;
  status: string | null;
};

function JournalPage() {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [{ data: e }, { data: s }] = await Promise.all([
        supabase
          .from("journal_entries")
          .select("id, session_id, summary, patterns, created_at")
          .order("created_at", { ascending: false }),
        supabase
          .from("sessions")
          .select(
            "id, title, created_at, updated_at, emotional_start, emotional_current, emotional_end, active_topic, patterns, status",
          )
          .order("updated_at", { ascending: false }),
      ]);
      setEntries((e as JournalEntry[]) ?? []);
      setSessions((s as SessionRow[]) ?? []);
      setLoading(false);
    })();
  }, []);

  const sessionsById = useMemo(() => {
    const m = new Map<string, SessionRow>();
    for (const s of sessions) m.set(s.id, s);
    return m;
  }, [sessions]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return { entries, sessions };
    return {
      entries: entries.filter(
        (e) =>
          e.summary.toLowerCase().includes(term) ||
          (e.patterns ?? []).some((p) => p.toLowerCase().includes(term)),
      ),
      sessions: sessions.filter(
        (s) =>
          s.title.toLowerCase().includes(term) ||
          (s.active_topic ?? "").toLowerCase().includes(term),
      ),
    };
  }, [q, entries, sessions]);

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <header className="border-b bg-background/80 backdrop-blur px-3 md:px-6 py-3 md:py-4 flex items-center gap-2 md:gap-3">
        <SidebarTrigger className="shrink-0" />
        <div className="flex-1 min-w-0">
          <h1 className="font-serif text-xl md:text-2xl leading-tight">Augimo žurnalas</h1>
          <p className="text-xs md:text-sm text-muted-foreground hidden sm:block truncate">
            Visų sesijų santraukos ir šablonai.
          </p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-3 md:p-6 bg-muted/20">
        <div className="max-w-4xl mx-auto space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Ieškoti pagal temą, šabloną ar tekstą…"
              className="pl-9"
            />
          </div>

          {loading && <div className="text-sm text-muted-foreground">Kraunama…</div>}

          {!loading && filtered.entries.length === 0 && filtered.sessions.length === 0 && (
            <Card className="p-10 text-center border-dashed">
              <div className="h-14 w-14 rounded-2xl bg-primary/10 text-primary mx-auto mb-4 flex items-center justify-center">
                <BookOpen className="h-7 w-7" />
              </div>
              <h2 className="font-serif text-2xl">Žurnalas dar tuščias</h2>
              <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
                Pradėk gyvą sesiją — AI automatiškai sukurs santrauką ir įrašys ją į tavo žurnalą.
              </p>
              <Button asChild className="mt-5">
                <Link to="/session">Pradėti sesiją</Link>
              </Button>
            </Card>
          )}

          {filtered.entries.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-xs uppercase tracking-widest text-muted-foreground">
                Sesijų santraukos ({filtered.entries.length})
              </h2>
              {filtered.entries.map((e) => {
                const s = e.session_id ? sessionsById.get(e.session_id) : null;
                return (
                  <Card key={e.id} className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                        <BookOpen className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-medium text-sm md:text-base">
                            {s?.title ?? "Sesijos santrauka"}
                          </h3>
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(e.created_at).toLocaleDateString("lt-LT")}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap line-clamp-4">
                          {e.summary}
                        </p>
                        {e.patterns && e.patterns.length > 0 && (
                          <div className="flex items-center gap-1.5 flex-wrap mt-2">
                            {e.patterns.map((p) => (
                              <Badge key={p} variant="secondary" className="text-[10px]">
                                {p}
                              </Badge>
                            ))}
                          </div>
                        )}
                        {s && (
                          <Button asChild size="sm" variant="ghost" className="mt-2 h-7 -ml-2 gap-1">
                            <Link to="/session" search={{ s: s.id }}>
                              Atverti sesiją <ArrowRight className="h-3 w-3" />
                            </Link>
                          </Button>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}

          {filtered.sessions.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-xs uppercase tracking-widest text-muted-foreground pt-4">
                Visos sesijos ({filtered.sessions.length})
              </h2>
              {filtered.sessions.map((s) => {
                const delta =
                  s.emotional_start != null && s.emotional_end != null
                    ? s.emotional_end - s.emotional_start
                    : null;
                return (
                  <Link key={s.id} to="/session" search={{ s: s.id }}>
                    <Card className="p-3 md:p-4 hover:bg-accent/40 transition">
                      <div className="flex items-start gap-3">
                        <div className="h-9 w-9 rounded-xl bg-muted flex items-center justify-center shrink-0">
                          <MessageSquare className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-medium text-sm truncate">{s.title}</h3>
                            {s.status && (
                              <Badge variant="outline" className="text-[10px]">
                                {s.status === "active" ? "Aktyvi" : "Užbaigta"}
                              </Badge>
                            )}
                            {delta != null && (
                              <Badge
                                variant="secondary"
                                className={`text-[10px] ${delta < 0 ? "text-map-green" : delta > 0 ? "text-map-rose" : ""}`}
                              >
                                {delta > 0 ? "+" : ""}
                                {delta} emocinis pokytis
                              </Badge>
                            )}
                          </div>
                          {s.active_topic && (
                            <p className="text-xs text-muted-foreground mt-1 truncate">
                              {s.active_topic}
                            </p>
                          )}
                          <div className="text-[10px] text-muted-foreground mt-1">
                            {new Date(s.updated_at).toLocaleString("lt-LT")}
                          </div>
                        </div>
                      </div>
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
