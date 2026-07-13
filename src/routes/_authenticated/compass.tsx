import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  ArrowRight,
  Brain,
  Calendar,
  CheckCircle2,
  Compass,
  Gem,
  HeartPulse,
  Loader2,
  Scale,
  Sparkles,
  Target,
} from "lucide-react";
import type { Json } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/compass")({ component: CompassPage });

type ValueRow = { id: string; name: string; rank: number };
type AssessmentValue = { name?: string; count?: number; evidence?: string[] };
type SessionRow = {
  id: string;
  title: string;
  emotional_start: number | null;
  emotional_end: number | null;
  emotional_current: number | null;
  grid: Json;
  updated_at: string;
};
type GoalRow = {
  id: string;
  title: string;
  description: string | null;
  progress: number;
  target_date: string | null;
  linked_value_id: string | null;
  updated_at: string;
};
type PriorityRow = {
  id: string;
  title: string;
  due_date: string | null;
  linked_goal_id: string | null;
  created_at: string;
};
type Recommendation = { title: string; reason: string; action: string; destination: string };

function CompassPage() {
  const [loading, setLoading] = useState(true);
  const [values, setValues] = useState<(ValueRow & { count: number; evidence: string[] })[]>([]);
  const [tension, setTension] = useState<{ left: string; right: string; evidence?: string } | null>(
    null,
  );
  const [goal, setGoal] = useState<GoalRow | null>(null);
  const [priorities, setPriorities] = useState<PriorityRow[]>([]);
  const [emotion, setEmotion] = useState<{ start: number; end: number; sessions: number } | null>(
    null,
  );
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [recommending, setRecommending] = useState(false);

  useEffect(() => {
    void load();
    // Dashboard snapshot is loaded once on entry; navigation back remounts this route.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    const [
      { data: valueRows },
      { data: assessment },
      { data: sessionRows },
      { data: goalRows },
      { data: priorityRows },
    ] = await Promise.all([
      supabase.from("values").select("id,name,rank").lt("rank", 100).order("rank").limit(5),
      supabase
        .from("value_assessments")
        .select("result")
        .eq("status", "completed")
        .order("completed_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("sessions")
        .select("id,title,emotional_start,emotional_end,emotional_current,grid,updated_at")
        .order("updated_at", { ascending: false })
        .limit(20),
      supabase
        .from("goals")
        .select("id,title,description,progress,target_date,linked_value_id,updated_at")
        .eq("status", "active")
        .order("updated_at", { ascending: false })
        .limit(10),
      supabase
        .from("priorities")
        .select("id,title,due_date,linked_goal_id,created_at")
        .eq("done", false)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);
    const result = Array.isArray(assessment?.result)
      ? (assessment.result as unknown as AssessmentValue[])
      : [];
    const assessmentByName = new Map(result.map((item) => [normalize(item.name ?? ""), item]));
    const topValues = ((valueRows as ValueRow[]) ?? []).map((value) => {
      const item = assessmentByName.get(normalize(value.name));
      return {
        ...value,
        count: Number(item?.count) || 0,
        evidence: Array.isArray(item?.evidence) ? item.evidence.slice(0, 2) : [],
      };
    });
    const sessions = (sessionRows as SessionRow[]) ?? [];
    const tensionSession = sessions.find((session) => {
      const grid = asGrid(session.grid);
      return grid["Vertybių konfliktas A"] && grid["Vertybių konfliktas B"];
    });
    const tensionGrid = tensionSession ? asGrid(tensionSession.grid) : {};
    const currentTension = tensionSession
      ? {
          left: tensionGrid["Vertybių konfliktas A"],
          right: tensionGrid["Vertybių konfliktas B"],
          evidence: tensionGrid["Vertybinės dinamikos pagrindas"],
        }
      : null;
    const goals = (goalRows as GoalRow[]) ?? [];
    const activeGoal =
      [...goals].sort((a, b) => {
        if (a.target_date && b.target_date) return a.target_date.localeCompare(b.target_date);
        if (a.target_date) return -1;
        if (b.target_date) return 1;
        return b.updated_at.localeCompare(a.updated_at);
      })[0] ?? null;
    const openPriorities = ((priorityRows as PriorityRow[]) ?? [])
      .sort((a, b) => {
        if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
        if (a.due_date) return -1;
        if (b.due_date) return 1;
        return b.created_at.localeCompare(a.created_at);
      })
      .slice(0, 3);
    const completed = sessions
      .filter((session) => session.emotional_start != null && session.emotional_end != null)
      .slice(0, 5);
    const emotional = completed.length
      ? {
          start:
            completed.reduce((sum, session) => sum + session.emotional_start!, 0) /
            completed.length,
          end:
            completed.reduce((sum, session) => sum + session.emotional_end!, 0) / completed.length,
          sessions: completed.length,
        }
      : null;
    setValues(topValues);
    setTension(currentTension);
    setGoal(activeGoal);
    setPriorities(openPriorities);
    setEmotion(emotional);
    setLoading(false);
    await generateRecommendation({
      values: topValues.map((value) => ({ name: value.name, count: value.count })),
      tension: currentTension,
      goal: activeGoal,
      priorities: openPriorities,
      emotion: emotional,
    });
  }

  async function generateRecommendation(snapshot: unknown) {
    setRecommending(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return;
      const response = await fetch("/api/compass-recommendation", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ snapshot }),
      });
      if (!response.ok) return;
      const body = (await response.json()) as { recommendation?: Recommendation | null };
      setRecommendation(body.recommendation ?? null);
    } finally {
      setRecommending(false);
    }
  }

  if (loading)
    return <div className="flex-1 p-8 text-sm text-muted-foreground">Kuriamas tavo kompasas…</div>;

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <header className="app-page-header">
        <SidebarTrigger />
        <div>
          <h1 className="font-serif text-xl md:text-2xl">Mano kompasas</h1>
          <p className="hidden text-sm text-muted-foreground sm:block">
            Tai, kas tau svarbu, ir vienas aiškus kitas žingsnis.
          </p>
        </div>
      </header>
      <div className="app-page-body">
        <div className="mx-auto max-w-6xl space-y-5">
          <Card className="relative overflow-hidden border-primary/15 bg-gradient-to-br from-primary/[0.11] via-card to-map-teal/[0.08] p-5 md:p-7">
            <div className="absolute -right-12 -top-20 h-60 w-60 rounded-full bg-primary/10 blur-3xl" />
            <div className="relative grid gap-5 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                  <Compass className="h-4 w-4" /> Asmeninis augimo kompasas
                </div>
                <h2 className="mt-3 font-serif text-3xl leading-tight md:text-4xl">
                  {recommendation?.title ?? "Sujungiame tavo kryptį su veiksmais"}
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                  {recommendation?.reason ??
                    "Kompasas apjungia tavo vertybes, dabartinę įtampą, tikslus ir savaitės veiksmus."}
                </p>
                {recommendation?.action && (
                  <p className="mt-4 border-l-2 border-primary/30 pl-3 text-sm font-medium">
                    {recommendation.action}
                  </p>
                )}
              </div>
              <Button asChild className="gap-2" disabled={recommending}>
                <Link to={(recommendation?.destination ?? "/priorities") as never}>
                  {recommending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}{" "}
                  Kitas žingsnis <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="p-5">
              <SectionTitle icon={Gem} title="TOP 5 vertybės" link="/values" />
              {values.length ? (
                <div className="mt-4 space-y-3">
                  {values.map((value) => (
                    <div key={value.id} className="flex items-start gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 font-serif text-primary">
                        {value.rank}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{value.name}</span>
                          {value.count > 0 && (
                            <Badge variant="secondary" className="text-[10px]">
                              {value.count} įrodymai
                            </Badge>
                          )}
                        </div>
                        {value.evidence[0] && (
                          <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                            {value.evidence[0]}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <Empty text="Atlik vertybių nustatymo pratimą." to="/values" />
              )}
            </Card>
            <Card className="p-5">
              <SectionTitle icon={Scale} title="Svarbiausia vertybinė įtampa" link="/session" />
              {tension ? (
                <div className="mt-5 rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 to-background p-5 dark:border-violet-900 dark:from-violet-950/20">
                  <div className="font-serif text-2xl">
                    {tension.left} <span className="text-primary">↔</span> {tension.right}
                  </div>
                  {tension.evidence && (
                    <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                      {tension.evidence}
                    </p>
                  )}
                </div>
              ) : (
                <Empty text="Aktyvi vertybinė įtampa dar neatpažinta." to="/session" />
              )}
            </Card>
            <Card className="p-5">
              <SectionTitle icon={Target} title="Aktyvus tikslas" link="/goals" />
              {goal ? (
                <div className="mt-4">
                  <h3 className="font-serif text-2xl">{goal.title}</h3>
                  {goal.description && (
                    <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                      {goal.description}
                    </p>
                  )}
                  <div className="mt-4 flex items-center gap-3">
                    <Progress value={goal.progress} className="h-2 flex-1" />
                    <span className="text-sm font-medium">{goal.progress}%</span>
                  </div>
                  {goal.target_date && (
                    <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Calendar className="h-3.5 w-3.5" /> Iki{" "}
                      {new Date(goal.target_date).toLocaleDateString("lt-LT")}
                    </div>
                  )}
                </div>
              ) : (
                <Empty text="Pasirink vieną aktyvų tikslą." to="/goals" />
              )}
            </Card>
            <Card className="p-5">
              <SectionTitle icon={CheckCircle2} title="3 savaitės prioritetai" link="/priorities" />
              {priorities.length ? (
                <div className="mt-4 space-y-2">
                  {priorities.map((priority, index) => (
                    <div
                      key={priority.id}
                      className="flex items-start gap-3 rounded-xl border bg-muted/20 p-3"
                    >
                      <div className="font-serif text-lg text-primary">0{index + 1}</div>
                      <div className="flex-1 text-sm font-medium">
                        {priority.title}
                        {priority.due_date && (
                          <div className="mt-1 text-[11px] font-normal text-muted-foreground">
                            {new Date(priority.due_date).toLocaleDateString("lt-LT")}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <Empty text="Pasirink iki trijų savaitės veiksmų." to="/priorities" />
              )}
            </Card>
          </div>

          <Card className="p-5 md:p-6">
            <SectionTitle icon={HeartPulse} title="Emocinio krūvio pokytis" link="/progress" />
            {emotion ? (
              <div className="mt-5 grid gap-4 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
                <EmotionStat label="Sesijų pradžioje" value={emotion.start} />
                <div className="text-center">
                  <div className="font-serif text-3xl text-map-green">
                    −{Math.max(0, emotion.start - emotion.end).toFixed(1)}
                  </div>
                  <div className="text-[10px] text-muted-foreground">vidutinis pokytis</div>
                </div>
                <EmotionStat label="Sesijų pabaigoje" value={emotion.end} />
              </div>
            ) : (
              <Empty
                text="Užbaik sesiją su emociniu įvertinimu pradžioje ir pabaigoje."
                to="/session"
              />
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function SectionTitle({
  icon: Icon,
  title,
  link,
}: {
  icon: typeof Brain;
  title: string;
  link: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="rounded-lg bg-primary/10 p-2 text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <h2 className="font-serif text-xl">{title}</h2>
      <Button asChild variant="ghost" size="sm" className="ml-auto">
        <Link to={link as never}>
          Atverti <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </Button>
    </div>
  );
}
function Empty({ text, to }: { text: string; to: string }) {
  return (
    <div className="mt-4 rounded-xl border border-dashed p-5 text-center">
      <p className="text-sm text-muted-foreground">{text}</p>
      <Button asChild variant="outline" size="sm" className="mt-3">
        <Link to={to as never}>Pradėti</Link>
      </Button>
    </div>
  );
}
function EmotionStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-muted/40 p-4 text-center">
      <div className="font-serif text-3xl">
        {value.toFixed(1)}
        <span className="text-sm text-muted-foreground"> / 10</span>
      </div>
      <div className="mt-1 text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
function asGrid(value: Json): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
}
function normalize(value: string) {
  return value.trim().toLocaleLowerCase("lt-LT").replace(/\s+/g, " ");
}
