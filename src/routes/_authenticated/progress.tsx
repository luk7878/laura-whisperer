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
import {
  Activity,
  ArrowDown,
  BarChart3,
  CalendarCheck,
  Sparkles,
  TrendingDown,
} from "lucide-react";

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
    const src =
      snaps.length > 0
        ? snaps
            .filter((s) => s.emotional_start != null && s.emotional_end != null)
            .map((s) => ({
              date: new Date(s.created_at).toLocaleDateString("lt-LT", {
                month: "short",
                day: "numeric",
              }),
              start: s.emotional_start!,
              end: s.emotional_end!,
              delta: s.emotional_end! - s.emotional_start!,
            }))
        : sessions
            .filter((s) => s.emotional_start != null && s.emotional_end != null)
            .map((s) => ({
              date: new Date(s.created_at).toLocaleDateString("lt-LT", {
                month: "short",
                day: "numeric",
              }),
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
  const improvedSessions = closed.filter(
    (session) => session.emotional_end! < session.emotional_start!,
  ).length;
  const improvementRate = closed.length
    ? Math.round((improvedSessions / closed.length) * 100)
    : null;
  const latestMonthCount = monthlyCount.at(-1)?.count ?? 0;

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
        <div className="max-w-6xl mx-auto space-y-5">
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
              <Card className="relative overflow-hidden border-primary/15 bg-gradient-to-br from-primary/[0.08] via-card to-map-green/[0.06] p-5 md:p-7">
                <div className="absolute -right-12 -top-16 h-48 w-48 rounded-full bg-primary/10 blur-3xl" />
                <div className="relative flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                  <div className="max-w-xl">
                    <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                      <Sparkles className="h-4 w-4" /> Tavo augimo apžvalga
                    </div>
                    <h2 className="font-serif text-2xl md:text-3xl">
                      {avgDelta != null && avgDelta < 0
                        ? "Sesijos padeda mažinti emocinį krūvį"
                        : "Kiekviena sesija kuria aiškesnį vaizdą"}
                    </h2>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      {improvementRate != null
                        ? `${improvementRate}% užbaigtų sesijų emocinis krūvis sumažėjo. Stebėk ne tobulumą, o kryptį ir pastovumą.`
                        : "Užbaik sesiją įvertindamas savijautą pradžioje ir pabaigoje — tuomet matysi tikrą pokytį."}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3 rounded-2xl border bg-background/70 px-4 py-3 shadow-sm backdrop-blur">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-map-green/15 text-map-green">
                      <ArrowDown className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="font-serif text-2xl leading-none">
                        {avgDelta == null ? "—" : Math.abs(avgDelta).toFixed(1)}
                      </div>
                      <div className="mt-1 text-[11px] text-muted-foreground">
                        vidutinis palengvėjimas
                      </div>
                    </div>
                  </div>
                </div>
              </Card>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard
                  icon={CalendarCheck}
                  label="Visos sesijos"
                  value={totalSessions}
                  note="tavo kelionėje"
                />
                <StatCard
                  icon={Activity}
                  label="Šį mėnesį"
                  value={latestMonthCount}
                  note="sesijų ritmas"
                />
                <StatCard
                  icon={TrendingDown}
                  label="Geriausias pokytis"
                  value={bestDelta === 0 ? "—" : Math.abs(bestDelta)}
                  note="balais per sesiją"
                  tone="green"
                />
                <StatCard
                  icon={Sparkles}
                  label="Palengvėjo"
                  value={improvementRate == null ? "—" : `${improvementRate}%`}
                  note="užbaigtų sesijų"
                  tone="blue"
                />
              </div>

              {lineData.length > 0 && (
                <Card className="overflow-hidden">
                  <ChartHeader
                    title="Emocinio krūvio pokytis"
                    description="Kuo žemiau pabaigos linija, tuo didesnis palengvėjimas po sesijos."
                    legend
                  />
                  <div className="px-2 pb-4 pr-4 md:px-5 md:pb-6">
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
                            stroke="var(--map-rose)"
                            strokeWidth={2.5}
                            dot={{ r: 3, fill: "var(--card)", strokeWidth: 2 }}
                            activeDot={{ r: 5 }}
                          />
                          <Line
                            type="monotone"
                            dataKey="end"
                            name="Pabaiga"
                            stroke="var(--map-green)"
                            strokeWidth={2.5}
                            dot={{ r: 3, fill: "var(--card)", strokeWidth: 2 }}
                            activeDot={{ r: 5 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </Card>
              )}

              {monthlyCount.length > 0 && (
                <Card className="overflow-hidden">
                  <ChartHeader
                    title="Sesijų ritmas"
                    description="Pastovumas svarbiau už intensyvumą — stebėk savo tempą per laiką."
                  />
                  <div className="px-2 pb-4 pr-4 md:px-5 md:pb-6">
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
                            fill="var(--primary)"
                            radius={[10, 10, 2, 2]}
                            maxBarSize={72}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
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

function StatCard({
  icon: Icon,
  label,
  value,
  note,
  tone = "default",
}: {
  icon: typeof Activity;
  label: string;
  value: string | number;
  note: string;
  tone?: "default" | "green" | "blue";
}) {
  const color =
    tone === "green"
      ? "bg-map-green/15 text-map-green"
      : tone === "blue"
        ? "bg-primary/10 text-primary"
        : "bg-muted text-foreground";
  return (
    <Card className="group p-4 transition-all hover:-translate-y-0.5 hover:shadow-md md:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-medium text-muted-foreground">{label}</div>
          <div className="mt-2 font-serif text-3xl leading-none">{value}</div>
          <div className="mt-2 text-[11px] text-muted-foreground">{note}</div>
        </div>
        <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${color}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </Card>
  );
}

function ChartHeader({
  title,
  description,
  legend = false,
}: {
  title: string;
  description: string;
  legend?: boolean;
}) {
  return (
    <div className="flex flex-col gap-3 border-b bg-muted/20 p-4 md:flex-row md:items-start md:justify-between md:p-5">
      <div>
        <h2 className="font-serif text-xl">{title}</h2>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
      </div>
      {legend && (
        <div className="flex shrink-0 items-center gap-3 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-map-rose" /> Pradžia
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-map-green" /> Pabaiga
          </span>
        </div>
      )}
    </div>
  );
}
