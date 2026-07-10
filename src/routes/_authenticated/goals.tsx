import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Target,
  Plus,
  Calendar,
  Link2,
  Sparkles,
  ChevronDown,
  ChevronRight,
  Wand2,
  Loader2,
  ArrowRight,
  Brain,
  CheckCircle2,
  Clock3,
  Compass,
  Flame,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/goals")({
  component: GoalsPage,
});

type Goal = {
  id: string;
  title: string;
  description: string | null;
  target_date: string | null;
  status: string;
  progress: number;
  linked_plan_id: string | null;
  created_at: string;
};

type Task = {
  id: string;
  goal_id: string;
  parent_id: string | null;
  title: string;
  why: string | null;
  estimate: string | null;
  due_date: string | null;
  depth: number;
  sort_order: number;
  done: boolean;
};

function GoalsPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [generatingFor, setGeneratingFor] = useState<string | null>(null);

  async function load() {
    const [{ data: g }, { data: t }] = await Promise.all([
      supabase
        .from("goals")
        .select("id, title, description, target_date, status, progress, linked_plan_id, created_at")
        .order("created_at", { ascending: false }),
      supabase
        .from("goal_tasks")
        .select("id, goal_id, parent_id, title, why, estimate, due_date, depth, sort_order, done")
        .order("sort_order", { ascending: true }),
    ]);
    setGoals((g as Goal[]) ?? []);
    setTasks((t as Task[]) ?? []);
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  const tasksByGoal = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const t of tasks) {
      const arr = map.get(t.goal_id) ?? [];
      arr.push(t);
      map.set(t.goal_id, arr);
    }
    return map;
  }, [tasks]);

  const activeGoals = goals.filter((goal) => goal.status === "active");
  const openTasks = tasks.filter((task) => !task.done);
  const completedTasks = tasks.filter((task) => task.done).length;
  const overdueTasks = openTasks.filter(
    (task) => task.due_date && new Date(task.due_date).getTime() < new Date().setHours(0, 0, 0, 0),
  );
  const focusTask = [...openTasks].sort((a, b) => {
    if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
    if (a.due_date) return -1;
    if (b.due_date) return 1;
    return a.depth - b.depth || a.sort_order - b.sort_order;
  })[0];
  const focusGoal = focusTask
    ? goals.find((goal) => goal.id === focusTask.goal_id)
    : activeGoals[0];
  const overallProgress = tasks.length ? Math.round((completedTasks / tasks.length) * 100) : 0;

  function toggleExpanded(id: string) {
    setExpanded((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  async function toggleTask(t: Task) {
    const next = !t.done;
    setTasks((xs) => xs.map((x) => (x.id === t.id ? { ...x, done: next } : x)));
    const { error } = await supabase
      .from("goal_tasks")
      .update({ done: next, done_at: next ? new Date().toISOString() : null })
      .eq("id", t.id);
    if (error) {
      toast.error(error.message);
      load();
      return;
    }
    // atnaujinam tikslo progresą
    const all = tasks.map((x) => (x.id === t.id ? { ...x, done: next } : x));
    const list = all.filter((x) => x.goal_id === t.goal_id);
    if (list.length > 0) {
      const done = list.filter((x) => x.done).length;
      const pct = Math.round((done / list.length) * 100);
      await supabase.from("goals").update({ progress: pct }).eq("id", t.goal_id);
      setGoals((gs) => gs.map((g) => (g.id === t.goal_id ? { ...g, progress: pct } : g)));
    }
  }

  async function generateBreakdown(goal: Goal) {
    setGeneratingFor(goal.id);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;
      const resp = await fetch("/api/goal-breakdown", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goal_title: goal.title,
          goal_description: goal.description,
          target_date: goal.target_date,
        }),
      });
      if (!resp.ok) throw new Error(await resp.text().catch(() => "AI klaida"));
      const breakdown = (await resp.json()) as import("@/lib/insert-task-tree").AIBreakdown;
      const { insertTaskTree } = await import("@/lib/insert-task-tree");
      const n = await insertTaskTree({
        userId: userData.user.id,
        goalId: goal.id,
        breakdown,
      });
      toast.success(`Sukurta ${n} užduočių`);
      setExpanded((s) => new Set(s).add(goal.id));
      await load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Nepavyko sugeneruoti");
    } finally {
      setGeneratingFor(null);
    }
  }

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <header className="border-b bg-background/80 backdrop-blur px-3 md:px-6 py-3 md:py-4 flex items-center gap-2 md:gap-3">
        <SidebarTrigger className="shrink-0" />
        <div className="flex-1 min-w-0">
          <h1 className="font-serif text-xl md:text-2xl leading-tight">Tikslai</h1>
          <p className="text-xs md:text-sm text-muted-foreground hidden sm:block truncate">
            AI sudėlioja kelią nuo tikslo iki rezultato.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-1.5 h-9 px-2 md:px-3 shrink-0">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Naujas tikslas</span>
            </Button>
          </DialogTrigger>
          <NewGoalDialog
            onCreated={() => {
              setOpen(false);
              load();
            }}
          />
        </Dialog>
      </header>

      <div className="flex-1 overflow-y-auto p-3 md:p-6 bg-muted/20">
        <div className="max-w-6xl mx-auto space-y-5">
          {loading && <div className="text-sm text-muted-foreground">Kraunama…</div>}
          {!loading && goals.length === 0 && (
            <Card className="p-10 text-center border-dashed">
              <div className="h-14 w-14 rounded-2xl bg-primary/10 text-primary mx-auto mb-4 flex items-center justify-center">
                <Target className="h-7 w-7" />
              </div>
              <h2 className="font-serif text-2xl">Dar nėra tikslų</h2>
              <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
                Užbaik „Tikslo išgryninimo" sesiją – AI automatiškai sukurs tikslą ir suskaidys jį į
                žingsnius bei sub-užduotis.
              </p>
              <Button asChild variant="outline" className="mt-5">
                <Link to="/session">
                  <Sparkles className="h-4 w-4 mr-1.5" /> Pradėti sesiją
                </Link>
              </Button>
            </Card>
          )}
          {!loading && goals.length > 0 && (
            <>
              <Card className="relative overflow-hidden border-primary/15 bg-gradient-to-br from-primary/[0.09] via-card to-map-violet/[0.06] p-5 md:p-7">
                <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-primary/10 blur-3xl" />
                <div className="relative grid gap-6 lg:grid-cols-[1.35fr_0.65fr] lg:items-center">
                  <div>
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                      <Compass className="h-4 w-4" /> Šiandienos kryptis
                    </div>
                    {focusTask && focusGoal ? (
                      <>
                        <h2 className="mt-3 font-serif text-2xl leading-tight md:text-3xl">
                          {focusTask.title}
                        </h2>
                        <p className="mt-2 text-sm text-muted-foreground">
                          Šis veiksmas artina prie tikslo:{" "}
                          <span className="font-medium text-foreground">{focusGoal.title}</span>
                        </p>
                        {focusTask.why && (
                          <p className="mt-3 max-w-2xl border-l-2 border-primary/30 pl-3 text-sm italic leading-relaxed text-muted-foreground">
                            {focusTask.why}
                          </p>
                        )}
                        <div className="mt-4 flex flex-wrap items-center gap-2">
                          <Button size="sm" className="gap-2" onClick={() => toggleTask(focusTask)}>
                            <CheckCircle2 className="h-4 w-4" /> Pažymėti atliktu
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-2"
                            onClick={() =>
                              setExpanded((current) => new Set(current).add(focusGoal.id))
                            }
                          >
                            Atverti planą <ArrowRight className="h-4 w-4" />
                          </Button>
                          {focusTask.estimate && (
                            <Badge variant="secondary" className="gap-1.5">
                              <Clock3 className="h-3.5 w-3.5" /> {focusTask.estimate}
                            </Badge>
                          )}
                        </div>
                      </>
                    ) : (
                      <>
                        <h2 className="mt-3 font-serif text-2xl md:text-3xl">
                          Laikas išgryninti kitą žingsnį
                        </h2>
                        <p className="mt-2 text-sm text-muted-foreground">
                          Tikslai jau yra, tačiau dar nėra konkrečių veiksmų. Suskaidyk vieną tikslą
                          su AI.
                        </p>
                      </>
                    )}
                  </div>
                  <div className="rounded-2xl border bg-background/75 p-4 shadow-sm backdrop-blur">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground">
                        Bendras įgyvendinimas
                      </span>
                      <span className="font-serif text-2xl">{overallProgress}%</span>
                    </div>
                    <Progress value={overallProgress} className="mt-3 h-2" />
                    <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                      <MiniStat value={activeGoals.length} label="aktyvūs" />
                      <MiniStat value={openTasks.length} label="liko" />
                      <MiniStat value={completedTasks} label="atlikta" />
                    </div>
                  </div>
                </div>
              </Card>

              <div className="grid gap-3 md:grid-cols-3">
                <InsightCard
                  icon={Flame}
                  title="Savaitės fokusas"
                  value={focusGoal?.title ?? "Pasirink vieną kryptį"}
                  text="Mažiau vienu metu — daugiau užbaigtų rezultatų."
                />
                <InsightCard
                  icon={Brain}
                  title="Vertybių patikra"
                  value="Ar tai tikrai tavo tikslas?"
                  text="Tikslas turi realizuoti tai, kas tau svarbu, o ne vien išorinį lūkestį."
                />
                <InsightCard
                  icon={overdueTasks.length ? Clock3 : TrendingUp}
                  title="Ritmo signalas"
                  value={
                    overdueTasks.length
                      ? `${overdueTasks.length} vėluoja`
                      : "Ritmas kontroliuojamas"
                  }
                  text={
                    overdueTasks.length
                      ? "Peržiūrėk terminus arba sumažink dabartinę apimtį."
                      : "Tęsk vieną aiškų veiksmą po kito."
                  }
                  warning={overdueTasks.length > 0}
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <div>
                  <h2 className="font-serif text-xl">Tikslų portfelis</h2>
                  <p className="text-xs text-muted-foreground">
                    Išskleisk tikslą, kai nori dirbti su visu jo planu.
                  </p>
                </div>
                <Badge variant="outline">{activeGoals.length} aktyvūs</Badge>
              </div>
            </>
          )}
          {goals.map((g) => {
            const goalTasks = tasksByGoal.get(g.id) ?? [];
            const isExpanded = expanded.has(g.id);
            const hasTasks = goalTasks.length > 0;
            return (
              <Card
                key={g.id}
                className="overflow-hidden p-3 transition-shadow hover:shadow-md md:p-5"
              >
                <div className="flex items-start gap-2 md:gap-3">
                  <button
                    onClick={() => toggleExpanded(g.id)}
                    className="mt-1 text-muted-foreground hover:text-foreground shrink-0"
                    title={isExpanded ? "Suskleisti" : "Išskleisti"}
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </button>
                  <div className="h-9 w-9 md:h-10 md:w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <Target className="h-4 w-4 md:h-5 md:w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-medium text-sm md:text-base break-words">{g.title}</h3>
                      <Badge variant="outline" className="text-[10px]">
                        {g.status === "active" ? "Aktyvus" : g.status}
                      </Badge>
                      {g.linked_plan_id && (
                        <Badge variant="outline" className="text-[10px] gap-1">
                          <Link2 className="h-3 w-3" /> Iš plano
                        </Badge>
                      )}
                      {hasTasks && (
                        <Badge variant="secondary" className="text-[10px]">
                          {goalTasks.filter((t) => t.done).length}/{goalTasks.length}
                        </Badge>
                      )}
                    </div>
                    {g.description && (
                      <p className="text-xs md:text-sm text-muted-foreground mt-1 whitespace-pre-wrap line-clamp-3">
                        {g.description}
                      </p>
                    )}
                    <div className="mt-2 flex items-center gap-2 md:gap-3 flex-wrap">
                      <Progress value={g.progress} className="h-1.5 flex-1 min-w-[100px]" />
                      <span className="text-xs text-muted-foreground">{g.progress}%</span>
                      {g.target_date && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(g.target_date).toLocaleDateString("lt-LT")}
                        </span>
                      )}
                    </div>
                    {!hasTasks && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => generateBreakdown(g)}
                        disabled={generatingFor === g.id}
                        className="gap-1.5 mt-2 h-8 text-xs"
                        title="AI suskaidys šį tikslą į užduotis"
                      >
                        {generatingFor === g.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Wand2 className="h-3.5 w-3.5" />
                        )}
                        Skaidyti su AI
                      </Button>
                    )}
                  </div>
                </div>

                {isExpanded && (
                  <div className="mt-4 pl-11 border-l ml-5">
                    {hasTasks ? (
                      <TaskTree tasks={goalTasks} onToggle={toggleTask} />
                    ) : (
                      <p className="text-xs text-muted-foreground italic">
                        Užduočių dar nėra. Paspausk „Skaidyti su AI", kad automatiškai sudėliotum
                        planą iki rezultato.
                      </p>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function MiniStat({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-xl bg-muted/60 px-2 py-2.5">
      <div className="font-serif text-xl leading-none">{value}</div>
      <div className="mt-1 text-[10px] text-muted-foreground">{label}</div>
    </div>
  );
}

function InsightCard({
  icon: Icon,
  title,
  value,
  text,
  warning = false,
}: {
  icon: typeof Target;
  title: string;
  value: string;
  text: string;
  warning?: boolean;
}) {
  return (
    <Card className="p-4 md:p-5">
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
            warning ? "bg-map-orange/15 text-map-orange" : "bg-primary/10 text-primary",
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {title}
          </div>
          <div className="mt-1 line-clamp-2 font-medium leading-snug">{value}</div>
          <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{text}</p>
        </div>
      </div>
    </Card>
  );
}

function TaskTree({
  tasks,
  onToggle,
  parentId = null,
}: {
  tasks: Task[];
  onToggle: (t: Task) => void;
  parentId?: string | null;
}) {
  const level = tasks
    .filter((t) => t.parent_id === parentId)
    .sort((a, b) => a.sort_order - b.sort_order);
  if (level.length === 0) return null;
  return (
    <ul className="space-y-2 mt-2">
      {level.map((t) => {
        const children = tasks.filter((c) => c.parent_id === t.id);
        return (
          <li key={t.id}>
            <div className="flex items-start gap-2">
              <Checkbox checked={t.done} onCheckedChange={() => onToggle(t)} className="mt-0.5" />
              <div className="flex-1 min-w-0">
                <div
                  className={cn(
                    "text-sm",
                    t.depth === 0 && "font-medium",
                    t.done && "line-through text-muted-foreground",
                  )}
                >
                  {t.title}
                </div>
                {t.why && (
                  <div className="text-xs text-muted-foreground italic mt-0.5">{t.why}</div>
                )}
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  {t.estimate && (
                    <Badge variant="outline" className="text-[10px]">
                      {t.estimate}
                    </Badge>
                  )}
                  {t.due_date && (
                    <Badge variant="outline" className="text-[10px] gap-1">
                      <Calendar className="h-3 w-3" />
                      {new Date(t.due_date).toLocaleDateString("lt-LT")}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            {children.length > 0 && (
              <div className="pl-6 border-l ml-2 mt-2">
                <TaskTree tasks={tasks} onToggle={onToggle} parentId={t.id} />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function NewGoalDialog({ onCreated }: { onCreated: () => void }) {
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [date, setDate] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!title.trim()) return;
    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    const { error } = await supabase.from("goals").insert({
      user_id: userData.user.id,
      title: title.trim(),
      description: desc.trim() || null,
      target_date: date || null,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Tikslas išsaugotas");
    setTitle("");
    setDesc("");
    setDate("");
    onCreated();
  }

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle className="font-serif text-2xl">Naujas tikslas</DialogTitle>
      </DialogHeader>
      <div className="space-y-3">
        <div>
          <Label>Pavadinimas</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1.5" />
        </div>
        <div>
          <Label>Aprašymas</Label>
          <Textarea
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            rows={3}
            className="mt-1.5"
          />
        </div>
        <div>
          <Label>Terminas</Label>
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="mt-1.5 w-52"
          />
        </div>
      </div>
      <DialogFooter>
        <Button onClick={save} disabled={saving || !title.trim()}>
          Išsaugoti
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
