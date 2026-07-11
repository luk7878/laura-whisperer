import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Lightbulb, TrendingUp, Sparkles, Calendar } from "lucide-react";

export const Route = createFileRoute("/_authenticated/insights")({
  component: InsightsPage,
});

type SessionRow = {
  id: string;
  title: string;
  active_topic: string | null;
  patterns: string[] | null;
  created_at: string;
  updated_at: string;
  emotional_start: number | null;
  emotional_end: number | null;
};

type JournalEntry = {
  id: string;
  summary: string;
  patterns: string[] | null;
  created_at: string;
};

function InsightsPage() {
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const weekAgo = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
      const [{ data: s }, { data: e }] = await Promise.all([
        supabase
          .from("sessions")
          .select(
            "id, title, active_topic, patterns, created_at, updated_at, emotional_start, emotional_end",
          )
          .gte("created_at", weekAgo)
          .order("created_at", { ascending: false }),
        supabase
          .from("journal_entries")
          .select("id, summary, patterns, created_at")
          .gte("created_at", weekAgo)
          .order("created_at", { ascending: false }),
      ]);
      setSessions((s as SessionRow[]) ?? []);
      setEntries((e as JournalEntry[]) ?? []);
      setLoading(false);
    })();
  }, []);

  const patternCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of sessions)
      for (const p of s.patterns ?? []) counts.set(p, (counts.get(p) ?? 0) + 1);
    for (const e of entries)
      for (const p of e.patterns ?? []) counts.set(p, (counts.get(p) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [sessions, entries]);

  const topicCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of sessions) {
      if (s.active_topic) counts.set(s.active_topic, (counts.get(s.active_topic) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [sessions]);

  const avgDelta = useMemo(() => {
    const closed = sessions.filter(
      (s) => s.emotional_start != null && s.emotional_end != null,
    );
    if (closed.length === 0) return null;
    const sum = closed.reduce(
      (acc, s) => acc + (s.emotional_end! - s.emotional_start!),
      0,
    );
    return sum / closed.length;
  }, [sessions]);

  const empty = !loading && sessions.length === 0 && entries.length === 0;

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <header className="app-page-header">
        <SidebarTrigger className="shrink-0" />
        <div className="flex-1 min-w-0">
          <h1 className="font-serif text-xl md:text-2xl leading-tight">Įžvalgos</h1>
          <p className="text-xs md:text-sm text-muted-foreground hidden sm:block truncate">
            Kas kartojasi tavo augime per pastarąsias 30 dienų.
          </p>
        </div>
      </header>

      <div className="app-page-body">
        <div className="max-w-4xl mx-auto space-y-4">
          {loading && <div className="text-sm text-muted-foreground">Kraunama…</div>}

          {empty && (
            <Card className="p-10 text-center border-dashed">
              <div className="h-14 w-14 rounded-2xl bg-primary/10 text-primary mx-auto mb-4 flex items-center justify-center">
                <Lightbulb className="h-7 w-7" />
              </div>
              <h2 className="font-serif text-2xl">Įžvalgų dar nėra</h2>
              <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
                Padaryk bent 1–2 sesijas — AI atpažins pasikartojančius šablonus ir vertybes.
              </p>
              <Button asChild className="mt-5">
                <Link to="/session">Pradėti sesiją</Link>
              </Button>
            </Card>
          )}

          {!empty && !loading && (
            <>
              <div className="grid gap-3 md:grid-cols-3">
                <Card className="p-4">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5" /> Sesijų
                  </div>
                  <div className="font-serif text-3xl mt-1">{sessions.length}</div>
                  <div className="text-xs text-muted-foreground">per 30 d.</div>
                </Card>
                <Card className="p-4">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
                    <TrendingUp className="h-3.5 w-3.5" /> Vid. emocinis pokytis
                  </div>
                  <div
                    className={`font-serif text-3xl mt-1 ${avgDelta != null && avgDelta < 0 ? "text-map-green" : avgDelta != null && avgDelta > 0 ? "text-map-rose" : ""}`}
                  >
                    {avgDelta == null ? "—" : `${avgDelta > 0 ? "+" : ""}${avgDelta.toFixed(1)}`}
                  </div>
                  <div className="text-xs text-muted-foreground">iš uždarytų sesijų</div>
                </Card>
                <Card className="p-4">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
                    <Sparkles className="h-3.5 w-3.5" /> Šablonų
                  </div>
                  <div className="font-serif text-3xl mt-1">{patternCounts.length}</div>
                  <div className="text-xs text-muted-foreground">unikalių</div>
                </Card>
              </div>

              <Card className="p-4 md:p-5">
                <h2 className="font-serif text-xl mb-3">Pasikartojantys šablonai</h2>
                {patternCounts.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Šablonų dar nėra — jie atsiranda AI atpažįstant tavo mąstymo modelius sesijose.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {patternCounts.map(([name, count]) => (
                      <Badge
                        key={name}
                        variant="secondary"
                        className="text-xs gap-1.5 py-1 px-2"
                      >
                        {name}
                        <span className="text-[10px] text-muted-foreground">×{count}</span>
                      </Badge>
                    ))}
                  </div>
                )}
              </Card>

              {topicCounts.length > 0 && (
                <Card className="p-4 md:p-5">
                  <h2 className="font-serif text-xl mb-3">Dažniausios temos</h2>
                  <ul className="space-y-2">
                    {topicCounts.map(([topic, count]) => (
                      <li key={topic} className="flex items-center gap-2">
                        <span className="flex-1 text-sm truncate">{topic}</span>
                        <Badge variant="outline" className="text-[10px]">
                          {count} kartai
                        </Badge>
                      </li>
                    ))}
                  </ul>
                </Card>
              )}

              {entries.length > 0 && (
                <Card className="p-4 md:p-5">
                  <h2 className="font-serif text-xl mb-3">Paskutinės įžvalgos</h2>
                  <ul className="space-y-3">
                    {entries.slice(0, 5).map((e) => (
                      <li key={e.id} className="border-l-2 border-primary/30 pl-3">
                        <p className="text-sm line-clamp-3 whitespace-pre-wrap">{e.summary}</p>
                        <div className="text-[10px] text-muted-foreground mt-1">
                          {new Date(e.created_at).toLocaleDateString("lt-LT")}
                        </div>
                      </li>
                    ))}
                  </ul>
                </Card>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
