import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ListChecks,
  Plus,
  Calendar,
  Link2,
  Sparkles,
  Compass,
  Target,
  CheckCircle2,
  ArrowRight,
  Flame,
  Inbox,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/priorities")({ component: PrioritiesPage });

type Priority = {
  id: string;
  title: string;
  due_date: string | null;
  done: boolean;
  linked_plan_id: string | null;
  linked_goal_id: string | null;
  linked_value_id: string | null;
  created_at: string;
};
type Value = { id: string; name: string; rank: number | null };
type Goal = { id: string; title: string };

function PrioritiesPage() {
  const [items, setItems] = useState<Priority[]>([]);
  const [values, setValues] = useState<Value[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  async function load() {
    const [{ data: priorities }, { data: valueRows }, { data: goalRows }] = await Promise.all([
      supabase
        .from("priorities")
        .select(
          "id, title, due_date, done, linked_plan_id, linked_goal_id, linked_value_id, created_at",
        )
        .order("done", { ascending: true })
        .order("due_date", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false }),
      supabase.from("values").select("id, name, rank").order("rank", { ascending: true }),
      supabase.from("goals").select("id, title").eq("status", "active"),
    ]);
    setItems((priorities as Priority[]) ?? []);
    setValues((valueRows as Value[]) ?? []);
    setGoals((goalRows as Goal[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function toggle(p: Priority) {
    const next = !p.done;
    setItems((xs) => xs.map((x) => (x.id === p.id ? { ...x, done: next } : x)));
    const { error } = await supabase.from("priorities").update({ done: next }).eq("id", p.id);
    if (error) {
      toast.error(error.message);
      load();
    } else if (next) toast.success("Žingsnis užbaigtas");
  }

  const active = items.filter((i) => !i.done);
  const done = items.filter((i) => i.done);
  const today = new Date().toISOString().slice(0, 10);
  const focus = active.slice(0, 3);
  const later = active.slice(3);
  const alignedCount = active.filter((i) => i.linked_value_id || i.linked_goal_id).length;
  const valueById = useMemo(() => new Map(values.map((v) => [v.id, v])), [values]);
  const goalById = useMemo(() => new Map(goals.map((g) => [g.id, g])), [goals]);

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <header className="app-page-header">
        <SidebarTrigger className="shrink-0" />
        <div className="min-w-0 flex-1">
          <h1 className="font-serif text-xl leading-tight md:text-2xl">Prioritetai</h1>
          <p className="hidden truncate text-sm text-muted-foreground sm:block">
            Ne daugiau darbų — daugiau veiksmų pagal tai, kas tau svarbiausia.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="h-9 shrink-0 gap-1.5 px-3">
              <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Naujas žingsnis</span>
            </Button>
          </DialogTrigger>
          <NewPriorityDialog
            values={values}
            goals={goals}
            onCreated={() => {
              setOpen(false);
              load();
            }}
          />
        </Dialog>
      </header>

      <div className="app-page-body">
        <div className="mx-auto max-w-5xl space-y-5">
          <section className="relative overflow-hidden rounded-3xl border bg-gradient-to-br from-primary/[0.08] via-background to-map-violet/[0.08] p-5 shadow-sm md:p-7">
            <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-primary/[0.06]" />
            <div className="relative grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                  <Sparkles className="h-4 w-4" /> Dienos kryptis
                </div>
                <h2 className="max-w-2xl font-serif text-2xl leading-tight md:text-3xl">
                  Ką šiandien gali padaryti, kad išreikštum savo aukščiausią vertybę?
                </h2>
                <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                  Demartini požiūriu disciplina atsiranda natūraliai, kai veiksmas aiškiai susietas
                  su tavo vertybių hierarchija.
                </p>
              </div>
              <div className="grid grid-cols-3 gap-2 lg:w-[310px]">
                <Stat
                  value={focus.length}
                  label="dienos fokusai"
                  icon={<Flame className="h-4 w-4" />}
                />
                <Stat value={alignedCount} label="susieti" icon={<Compass className="h-4 w-4" />} />
                <Stat
                  value={done.length}
                  label="užbaigta"
                  icon={<CheckCircle2 className="h-4 w-4" />}
                />
              </div>
            </div>
          </section>

          {loading && <div className="text-sm text-muted-foreground">Kraunama…</div>}
          {!loading && items.length === 0 && (
            <Card className="border-dashed p-10 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <ListChecks className="h-7 w-7" />
              </div>
              <h2 className="font-serif text-2xl">Pasirink pirmą prasmingą žingsnį</h2>
              <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                Sukurk konkretų veiksmą ir susiek jį su tikslu arba viena aukščiausių savo vertybių.
              </p>
            </Card>
          )}

          {focus.length > 0 && (
            <section>
              <div className="mb-3 flex items-end justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                    Šiandienos TOP 3
                  </p>
                  <h2 className="mt-1 font-serif text-2xl">Svarbiausia dabar</h2>
                </div>
                <span className="text-xs text-muted-foreground">
                  Užbaik prieš rinkdamasis daugiau
                </span>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                {focus.map((p, index) => (
                  <FocusCard
                    key={p.id}
                    index={index}
                    item={p}
                    today={today}
                    value={valueById.get(p.linked_value_id ?? "")}
                    goal={goalById.get(p.linked_goal_id ?? "")}
                    onToggle={toggle}
                  />
                ))}
              </div>
            </section>
          )}

          {later.length > 0 && (
            <section className="rounded-2xl border bg-card p-4 md:p-5">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Inbox className="h-4 w-4 text-muted-foreground" />
                  <h2 className="font-semibold">Toliau eilėje</h2>
                  <Badge variant="secondary">{later.length}</Badge>
                </div>
                <span className="hidden text-xs text-muted-foreground sm:block">
                  Ne viskas turi būti šiandienos prioritetas
                </span>
              </div>
              <div className="divide-y">
                {later.map((p) => (
                  <CompactRow
                    key={p.id}
                    item={p}
                    value={valueById.get(p.linked_value_id ?? "")}
                    goal={goalById.get(p.linked_goal_id ?? "")}
                    onToggle={toggle}
                  />
                ))}
              </div>
            </section>
          )}

          {done.length > 0 && (
            <section className="rounded-2xl border bg-card/60 p-4 md:p-5">
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Užbaigta · {done.length}
              </h2>
              <div className="divide-y opacity-65">
                {done.map((p) => (
                  <CompactRow
                    key={p.id}
                    item={p}
                    value={valueById.get(p.linked_value_id ?? "")}
                    goal={goalById.get(p.linked_goal_id ?? "")}
                    onToggle={toggle}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ value, label, icon }: { value: number; label: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-2xl border bg-background/80 p-3 text-center shadow-sm">
      <div className="mx-auto mb-1 flex w-fit items-center gap-1 text-primary">
        {icon}
        <span className="font-serif text-2xl">{value}</span>
      </div>
      <div className="text-[10px] leading-tight text-muted-foreground">{label}</div>
    </div>
  );
}

function FocusCard({
  item,
  index,
  today,
  value,
  goal,
  onToggle,
}: {
  item: Priority;
  index: number;
  today: string;
  value?: Value;
  goal?: Goal;
  onToggle: (p: Priority) => void;
}) {
  const overdue = !!item.due_date && item.due_date < today;
  return (
    <Card className="group flex min-h-[230px] flex-col overflow-hidden border-primary/15 p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 font-serif text-lg text-primary">
          0{index + 1}
        </div>
        <Checkbox
          className="h-5 w-5 rounded-full"
          checked={item.done}
          onCheckedChange={() => onToggle(item)}
        />
      </div>
      <h3 className="mt-4 flex-1 text-base font-semibold leading-snug">{item.title}</h3>
      <div className="mt-4 space-y-2">
        {value && (
          <div className="flex items-center gap-2 text-xs text-map-violet">
            <Compass className="h-3.5 w-3.5" />
            <span className="line-clamp-1">Vertybė: {value.name}</span>
          </div>
        )}
        {goal && (
          <div className="flex items-center gap-2 text-xs text-primary">
            <Target className="h-3.5 w-3.5" />
            <span className="line-clamp-1">Tikslas: {goal.title}</span>
          </div>
        )}
        {!value && !goal && (
          <div className="text-xs italic text-muted-foreground">
            Susiek su vertybe, kad veiksmas turėtų aiškų „kodėl“.
          </div>
        )}
        {item.due_date && (
          <Badge variant={overdue ? "destructive" : "outline"} className="gap-1 text-[10px]">
            <Calendar className="h-3 w-3" />
            {new Date(item.due_date).toLocaleDateString("lt-LT")}
          </Badge>
        )}
      </div>
    </Card>
  );
}

function CompactRow({
  item,
  value,
  goal,
  onToggle,
}: {
  item: Priority;
  value?: Value;
  goal?: Goal;
  onToggle: (p: Priority) => void;
}) {
  return (
    <div className="flex items-center gap-3 py-3 first:pt-1 last:pb-1">
      <Checkbox
        className="rounded-full"
        checked={item.done}
        onCheckedChange={() => onToggle(item)}
      />
      <div className="min-w-0 flex-1">
        <div
          className={cn("text-sm font-medium", item.done && "line-through text-muted-foreground")}
        >
          {item.title}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
          {item.due_date && (
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {new Date(item.due_date).toLocaleDateString("lt-LT")}
            </span>
          )}
          {value && (
            <span className="flex items-center gap-1 text-map-violet">
              <Compass className="h-3 w-3" />
              {value.name}
            </span>
          )}
          {goal && (
            <span className="flex items-center gap-1 text-primary">
              <Link2 className="h-3 w-3" />
              {goal.title}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function NewPriorityDialog({
  values,
  goals,
  onCreated,
}: {
  values: Value[];
  goals: Goal[];
  onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [valueId, setValueId] = useState("none");
  const [goalId, setGoalId] = useState("none");
  const [saving, setSaving] = useState(false);
  async function save() {
    if (!title.trim()) return;
    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setSaving(false);
      return;
    }
    const { error } = await supabase.from("priorities").insert({
      user_id: userData.user.id,
      title: title.trim(),
      due_date: date || null,
      linked_value_id: valueId === "none" ? null : valueId,
      linked_goal_id: goalId === "none" ? null : goalId,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Prasmingas žingsnis išsaugotas");
    setTitle("");
    setDate("");
    setValueId("none");
    setGoalId("none");
    onCreated();
  }
  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle className="font-serif text-2xl">Naujas prasmingas žingsnis</DialogTitle>
      </DialogHeader>
      <p className="text-sm text-muted-foreground">
        Konkretus veiksmas tampa prioritetu tik tada, kai žinai, kokią vertę ar tikslą jis
        išreiškia.
      </p>
      <div className="space-y-4">
        <div>
          <Label>Ką konkrečiai užbaigsi?</Label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Veiksmažodis + aiškus rezultatas"
            className="mt-1.5"
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Aukščiausia vertybė</Label>
            <Select value={valueId} onValueChange={setValueId}>
              <SelectTrigger className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Dar nesusieta</SelectItem>
                {values.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Susijęs tikslas</Label>
            <Select value={goalId} onValueChange={setGoalId}>
              <SelectTrigger className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Dar nesusieta</SelectItem>
                {goals.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div>
          <Label>Kada užbaigsi?</Label>
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="mt-1.5 w-full sm:w-52"
          />
        </div>
      </div>
      <DialogFooter>
        <Button variant="ghost" asChild>
          <Link to="/goals">
            Peržiūrėti tikslus <ArrowRight className="ml-1 h-4 w-4" />
          </Link>
        </Button>
        <Button onClick={save} disabled={saving || !title.trim()}>
          Įtraukti į fokusą
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
