import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { BarChart3, TrendingDown } from "lucide-react";

export const Route = createFileRoute("/_authenticated/progress")({
  component: ProgressPage,
});

type Snap = {
  id: string;
  session_id: string | null;
  emotional_start: number | null;
  emotional_end: number | null;
  created_at: string;
};

type SessionRow = {
  id: string;
  title: string;
  created_at: string;
  emotional_start: number | null;
  emotional_end: number | null;
  status: string | null;
};

function ProgressPage() {
  const [snaps, setSnaps] = useState<Snap[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [{ data: sn }, { data: se }] = await Promise.all([
        supabase
          .from("progress_snapshots")
          .select("id, session_id, emotional_start, emotional_end, created_at")
          .order("created_at", { ascending: true }),
        supabase
          .from("sessions")
          .select("id, title, created_at, emotional_start, emotional_end, status")
          .order("created_at", { ascending: true }),
      ]);
      setSnaps((sn as Snap[]) ?? []);
      setSessions((se as SessionRow[]) ?? []);
      setLoading(false);
    })();
  }, []);

  const lineData = useMemo(() => {
    const src = snaps.length > 0
      ? snaps
          .filter((s) => s.emotional_start != null && s.emotional_end != null)
          .map((s) => ({
            date: new Date(s.created_at).toLocaleDateString("lt-LT", { month: "short", day: "numeric" }),
            start: s.emotional_start!,
            end: s.emotional_end!,
            delta: s.emotional_end! - s.emotional_start!,
          }))
      : sessions
          .filter((s) => s.emotional_start != null && s.emotional_end != null)
          .map((s) => ({
            date: new Date(s.created_at).toLocaleDateString("lt-LT", { month: "short", day: "numeric" }),
            start: s.emotional_start!,
            end: s.emotional_end!,
            delta: s.emotional_end! - s.emotional_start!,
          }));
    return src;
  }, [snaps, sessions]);

  const monthlyCount = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of sessions) {
      const d = new Date(s.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      m.set(key, (m.get(key) ?? 0) + 1);
    }
    return [...m.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-6)
      .map(([month, count]) => ({ month, count }));
  }, [sessions]);

  const totalSessions = sessions.length;
  const closed = sessions.filter((s) => s.emotional_start != null && s.emotional_end != null);
  const avgDelta =
    closed.length === 0
      ? null
      : closed.reduce((a, s) => a + (s.emotional_end! - s.emotional_start!), 0) / closed.length;
  const bestDelta = closed.reduce(
    (min, s) => Math.min(min, s.emotional_end! - s.emotional_start!),
    0,
  );

  const empty = !loading && lineData.length === 0 && totalSessions === 0;

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <header className="border-b bg-background/80 backdrop-blur px-3 md:px-6 py-3 md:py-4 flex items-center gap-2 md:gap-3">
        <SidebarTrigger className="shrink-0" />
        <div className="flex-1 min-w-0">
          <h1 className="font-serif text-xl md:text-2xl leading-tight">Pažanga</h1>
          <p className="text-xs md:text-sm text-muted-foreground hidden sm:block truncate">
            Emocinis palengvėjimas ir sesijų ritmas per laiką.
          </p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-3 md:p-6 bg-muted/20">
        <div className="max-w-5xl mx-auto space-y-4">
          {loading && <div className="text-sm text-muted-foreground">Kraunama…</div>}

          {empty && (
            <Card className="p-10 text-center border-dashed">
              <div className="h-14 w-14 rounded-2xl bg-primary/10 text-primary mx-auto mb-4 flex items-center justify-center">
                <BarChart3 className="h-7 w-7" />
              </div>
              <h2 className="font-serif text-2xl">Duomenų dar nėra</h2>
              <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
                Užbaik pirmą sesiją — čia atsiras tavo emocinio pokyčio kreivė ir mėnesio ritmas.
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
                  <div className="text-xs uppercase tracking-widest text-muted-foreground">Sesijos</div>
                  <div className="font-serif text-3xl mt-1">{totalSessions}</div>
                  <div className="text-xs text-muted-foreground">iš viso</div>
                </Card>
                <Card className="p-4">
                  <div className="text-xs uppercase tracking-widest text-muted-foreground">
                    Vidutinis pokytis
                  </div>
                  <div
                    className={`font-serif text-3xl mt-1 ${avgDelta != null && avgDelta < 0 ? "text-map-green" : avgDelta != null && avgDelta > 0 ? "text-map-rose" : ""}`}
                  >
                    {avgDelta == null ? "—" : `${avgDelta > 0 ? "+" : ""}${avgDelta.toFixed(1)}`}
                  </div>
                  <div className="text-xs text-muted-foreground">emocinio krūvio</div>
                </Card>
                <Card className="p-4">
                  <div className="text-xs uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                    <TrendingDown className="h-3.5 w-3.5" /> Geriausias pokytis
                  </div>
                  <div className="font-serif text-3xl mt-1 text-map-green">
                    {bestDelta === 0 ? "—" : bestDelta}
                  </div>
                  <div className="text-xs text-muted-foreground">viena sesija</div>
                </Card>
              </div>

              {lineData.length > 0 && (
                <Card className="p-4 md:p-5">
                  <h2 className="font-serif text-xl mb-1">Emocinio krūvio kreivė</h2>
                  <p className="text-xs text-muted-foreground mb-4">
                    Pradžia vs pabaiga kiekvienoje sesijoje (0 = ramu, 10 = įtempta).
                  </p>
                  <div className="h-64 md:h-72 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={lineData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis dataKey="date" fontSize={11} />
                        <YAxis domain={[0, 10]} fontSize={11} />
                        <Tooltip
                          contentStyle={{
                            background: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: 8,
                            fontSize: 12,
                          }}
                        />
                        <Line
                          type="monotone"
                          dataKey="start"
                          name="Pradžia"
                          stroke="hsl(var(--map-rose, 340 82% 62%))"
                          strokeWidth={2}
                          dot={{ r: 3 }}
                        />
                        <Line
                          type="monotone"
                          dataKey="end"
                          name="Pabaiga"
                          stroke="hsl(var(--map-green, 152 60% 45%))"
                          strokeWidth={2}
                          dot={{ r: 3 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
              )}

              {monthlyCount.length > 0 && (
                <Card className="p-4 md:p-5">
                  <h2 className="font-serif text-xl mb-1">Sesijų ritmas</h2>
                  <p className="text-xs text-muted-foreground mb-4">
                    Kiek sesijų padarei per pastaruosius mėnesius.
                  </p>
                  <div className="h-56 md:h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={monthlyCount}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis dataKey="month" fontSize={11} />
                        <YAxis allowDecimals={false} fontSize={11} />
                        <Tooltip
                          contentStyle={{
                            background: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: 8,
                            fontSize: 12,
                          }}
                        />
                        <Bar
                          dataKey="count"
                          name="Sesijos"
                          fill="hsl(var(--primary))"
                          radius={[6, 6, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
