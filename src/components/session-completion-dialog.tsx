import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Loader2,
  Plus,
  Trash2,
  ListChecks,
  Target,
  Flag,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Step = { id: string; title: string; why?: string; due_date: string; asPriority: boolean };

type SessionContext = {
  topic?: string | null;
  belief?: string | null;
  column?: string | null;
  emotion?: number | null;
  patterns?: string[] | null;
  messages?: { role: "user" | "assistant"; content: string }[];
};

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  sessionId: string;
  sessionTitle: string;
  sessionTopic: string | null;
  context?: SessionContext;
  onComplete?: () => void;
};

const STAGES = [
  { key: "plan", label: "Veiksmų planas", icon: ListChecks },
  { key: "goal", label: "Tikslas", icon: Target },
  { key: "priorities", label: "Prioritetai", icon: Flag },
] as const;

export function SessionCompletionDialog({
  open,
  onOpenChange,
  sessionId,
  sessionTitle,
  sessionTopic,
  context,
  onComplete,
}: Props) {
  const [stage, setStage] = useState<(typeof STAGES)[number]["key"]>("plan");
  const [saving, setSaving] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [suggested, setSuggested] = useState(false);

  // Plan
  const [planTitle, setPlanTitle] = useState("");
  const [planSummary, setPlanSummary] = useState("");
  const [steps, setSteps] = useState<Step[]>([
    { id: crypto.randomUUID(), title: "", due_date: "", asPriority: true },
  ]);

  // Goal
  const [goalTitle, setGoalTitle] = useState("");
  const [goalDesc, setGoalDesc] = useState("");
  const [goalDate, setGoalDate] = useState("");

  useEffect(() => {
    if (!open) return;
    const base = sessionTopic ?? sessionTitle ?? "";
    setPlanTitle(base ? `Planas: ${base}` : "Mano veiksmų planas");
    setGoalTitle(base ? base : "Mano tikslas");
    setStage("plan");
    setPlanSummary("");
    setSteps([{ id: crypto.randomUUID(), title: "", due_date: "", asPriority: true }]);
    setGoalDesc("");
    setGoalDate("");
    setSuggested(false);
  }, [open, sessionTopic, sessionTitle]);

  async function suggestWithAI() {
    if (suggesting) return;
    setSuggesting(true);
    try {
      const resp = await fetch("/api/plan-suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: context?.messages ?? [],
          topic: context?.topic ?? sessionTopic,
          belief: context?.belief,
          column: context?.column,
          emotion: context?.emotion,
          patterns: context?.patterns,
        }),
      });
      if (!resp.ok) throw new Error(await resp.text().catch(() => "AI klaida"));
      const data = (await resp.json()) as {
        plan_title?: string;
        plan_summary?: string;
        goal_title?: string;
        goal_description?: string;
        goal_target_days?: number;
        steps?: { title: string; why?: string; due_in_days?: number; as_priority?: boolean }[];
      };
      if (data.plan_title) setPlanTitle(data.plan_title);
      if (data.plan_summary) setPlanSummary(data.plan_summary);
      if (data.goal_title) setGoalTitle(data.goal_title);
      if (data.goal_description) setGoalDesc(data.goal_description);
      if (typeof data.goal_target_days === "number") {
        const d = new Date();
        d.setDate(d.getDate() + data.goal_target_days);
        setGoalDate(d.toISOString().slice(0, 10));
      }
      if (Array.isArray(data.steps) && data.steps.length) {
        setSteps(
          data.steps.map((s) => {
            const dd = new Date();
            if (typeof s.due_in_days === "number") dd.setDate(dd.getDate() + s.due_in_days);
            return {
              id: crypto.randomUUID(),
              title: s.title ?? "",
              why: s.why,
              due_date: typeof s.due_in_days === "number" ? dd.toISOString().slice(0, 10) : "",
              asPriority: s.as_priority ?? false,
            };
          }),
        );
      }
      setSuggested(true);
      toast.success("AI paruošė juodraštį – peržiūrėk ir pakoreguok");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Nepavyko sugeneruoti";
      toast.error(msg);
    } finally {
      setSuggesting(false);
    }
  }


  function addStep() {
    setSteps((s) => [
      ...s,
      { id: crypto.randomUUID(), title: "", due_date: "", asPriority: true },
    ]);
  }
  function removeStep(id: string) {
    setSteps((s) => (s.length === 1 ? s : s.filter((x) => x.id !== id)));
  }
  function updateStep(id: string, patch: Partial<Step>) {
    setSteps((s) => s.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  }

  const cleanSteps = steps.filter((s) => s.title.trim().length > 0);
  const canNextPlan = planTitle.trim().length > 0 && cleanSteps.length > 0;
  const canNextGoal = goalTitle.trim().length > 0;

  async function save() {
    if (saving) return;
    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error("Neprisijungęs");

      const stepsPayload = cleanSteps.map((s) => ({
        id: s.id,
        title: s.title.trim(),
        due_date: s.due_date || null,
        done: false,
      }));

      const { data: plan, error: pErr } = await supabase
        .from("action_plans")
        .insert({
          user_id: uid,
          session_id: sessionId,
          title: planTitle.trim(),
          summary: planSummary.trim() || null,
          steps: stepsPayload,
        })
        .select("id")
        .single();
      if (pErr) throw pErr;

      const { data: goal, error: gErr } = await supabase
        .from("goals")
        .insert({
          user_id: uid,
          title: goalTitle.trim(),
          description: goalDesc.trim() || null,
          target_date: goalDate || null,
          linked_plan_id: plan.id,
          status: "active",
          progress: 0,
        })
        .select("id")
        .single();
      if (gErr) throw gErr;

      await supabase.from("action_plans").update({ goal_id: goal.id }).eq("id", plan.id);

      const priorityRows = cleanSteps
        .filter((s) => s.asPriority)
        .map((s) => ({
          user_id: uid,
          title: s.title.trim(),
          due_date: s.due_date || null,
          linked_plan_id: plan.id,
          linked_goal_id: goal.id,
        }));
      if (priorityRows.length > 0) {
        const { error: prErr } = await supabase.from("priorities").insert(priorityRows);
        if (prErr) throw prErr;
      }

      await supabase.from("sessions").update({ status: "closed" }).eq("id", sessionId);

      toast.success("Planas, tikslas ir prioritetai išsaugoti");
      onOpenChange(false);
      onComplete?.();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Nepavyko išsaugoti";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  const stageIndex = STAGES.findIndex((s) => s.key === stage);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Užbaikime sesiją: nuo įžvalgos į veiksmą
          </DialogTitle>
          <DialogDescription>
            Trys žingsniai: susidėliok planą, iškelk iš jo tikslą, atrink šios savaitės prioritetus.
          </DialogDescription>
        </DialogHeader>

        {/* Stepper */}
        <div className="flex items-center gap-2 py-2">
          {STAGES.map((s, i) => {
            const active = s.key === stage;
            const done = i < stageIndex;
            return (
              <div key={s.key} className="flex items-center gap-2 flex-1">
                <div
                  className={cn(
                    "h-8 w-8 rounded-full flex items-center justify-center text-xs font-medium border shrink-0",
                    active && "bg-primary text-primary-foreground border-primary",
                    done && "bg-map-green/15 text-map-green border-map-green/30",
                    !active && !done && "bg-muted text-muted-foreground",
                  )}
                >
                  {done ? <CheckCircle2 className="h-4 w-4" /> : <s.icon className="h-4 w-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className={cn("text-xs font-medium truncate", active && "text-primary")}>
                    {s.label}
                  </div>
                </div>
                {i < STAGES.length - 1 && (
                  <div className={cn("h-px flex-1", done ? "bg-map-green/40" : "bg-border")} />
                )}
              </div>
            );
          })}
        </div>

        <div className="flex-1 overflow-y-auto pr-1 space-y-4">
          {stage === "plan" && (
            <>
              <div>
                <Label>Plano pavadinimas</Label>
                <Input
                  value={planTitle}
                  onChange={(e) => setPlanTitle(e.target.value)}
                  placeholder="Pvz. Atkurti pusiausvyrą santykiuose"
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label>Trumpa esmė (nebūtina)</Label>
                <Textarea
                  value={planSummary}
                  onChange={(e) => setPlanSummary(e.target.value)}
                  placeholder="Ką supratau šioje sesijoje ir kokia kryptimi einu?"
                  rows={2}
                  className="mt-1.5"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Veiksmų žingsniai</Label>
                  <Button type="button" size="sm" variant="ghost" onClick={addStep} className="gap-1">
                    <Plus className="h-3.5 w-3.5" /> Pridėti žingsnį
                  </Button>
                </div>
                <div className="space-y-2">
                  {steps.map((s, idx) => (
                    <Card key={s.id} className="p-3 flex items-start gap-2">
                      <div className="h-7 w-7 rounded-full bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center shrink-0 mt-1">
                        {idx + 1}
                      </div>
                      <div className="flex-1 space-y-2 min-w-0">
                        <Input
                          value={s.title}
                          onChange={(e) => updateStep(s.id, { title: e.target.value })}
                          placeholder="Konkretus veiksmas..."
                        />
                        <div className="flex items-center gap-3">
                          <Input
                            type="date"
                            value={s.due_date}
                            onChange={(e) => updateStep(s.id, { due_date: e.target.value })}
                            className="w-40"
                          />
                          <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                            <Checkbox
                              checked={s.asPriority}
                              onCheckedChange={(v) => updateStep(s.id, { asPriority: !!v })}
                            />
                            Padaryti prioritetu
                          </label>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeStep(s.id)}
                        className="p-1.5 text-muted-foreground hover:text-destructive"
                        title="Šalinti"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </Card>
                  ))}
                </div>
              </div>
            </>
          )}

          {stage === "goal" && (
            <>
              <p className="text-sm text-muted-foreground">
                Iškelk tikslą, kurį šie veiksmai realiai įgyvendins. Pageidautina, kad tikslas atspindėtų
                tavo vertybę, o ne pasiskolintą lūkestį.
              </p>
              <div>
                <Label>Tikslo pavadinimas</Label>
                <Input
                  value={goalTitle}
                  onChange={(e) => setGoalTitle(e.target.value)}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label>Aprašymas</Label>
                <Textarea
                  value={goalDesc}
                  onChange={(e) => setGoalDesc(e.target.value)}
                  placeholder="Kaip atrodys, kai tikslas bus pasiektas? Ką pastebėsiu savyje ir aplinkoje?"
                  rows={3}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label>Terminas (nebūtinas)</Label>
                <Input
                  type="date"
                  value={goalDate}
                  onChange={(e) => setGoalDate(e.target.value)}
                  className="mt-1.5 w-52"
                />
              </div>
              <Card className="p-3 bg-muted/30 border-dashed">
                <div className="text-xs font-medium text-muted-foreground mb-1">Susijęs planas</div>
                <div className="text-sm">{planTitle}</div>
                <div className="text-xs text-muted-foreground mt-1">{cleanSteps.length} žingsniai</div>
              </Card>
            </>
          )}

          {stage === "priorities" && (
            <>
              <p className="text-sm text-muted-foreground">
                Pažymėk, kuriuos žingsnius nori pamatyti savo prioritetų sąraše. Rekomenduoju rinktis
                1–3 artimiausius — kad realiai išeitų padaryti.
              </p>
              <div className="space-y-2">
                {cleanSteps.map((s, idx) => (
                  <label
                    key={s.id}
                    className={cn(
                      "flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                      s.asPriority ? "border-primary/40 bg-primary/5" : "hover:bg-accent/40",
                    )}
                  >
                    <Checkbox
                      checked={s.asPriority}
                      onCheckedChange={(v) => updateStep(s.id, { asPriority: !!v })}
                      className="mt-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium">
                        {idx + 1}. {s.title}
                      </div>
                      {s.due_date && (
                        <Badge variant="outline" className="mt-1 text-[10px]">
                          {new Date(s.due_date).toLocaleDateString("lt-LT")}
                        </Badge>
                      )}
                    </div>
                  </label>
                ))}
              </div>
              <Card className="p-3 bg-map-green/5 border-map-green/20">
                <div className="text-xs font-medium text-map-green mb-1">Bus išsaugota</div>
                <ul className="text-sm space-y-0.5">
                  <li>1 veiksmų planas · {cleanSteps.length} žingsniai</li>
                  <li>1 tikslas · „{goalTitle}"</li>
                  <li>{cleanSteps.filter((s) => s.asPriority).length} prioritetai</li>
                </ul>
              </Card>
            </>
          )}
        </div>

        <DialogFooter className="flex-row justify-between sm:justify-between border-t pt-4">
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              const i = STAGES.findIndex((s) => s.key === stage);
              if (i > 0) setStage(STAGES[i - 1].key);
              else onOpenChange(false);
            }}
            disabled={saving}
          >
            <ChevronLeft className="h-4 w-4" />
            {stage === "plan" ? "Atšaukti" : "Atgal"}
          </Button>

          {stage !== "priorities" ? (
            <Button
              type="button"
              onClick={() => {
                const i = STAGES.findIndex((s) => s.key === stage);
                setStage(STAGES[i + 1].key);
              }}
              disabled={
                (stage === "plan" && !canNextPlan) || (stage === "goal" && !canNextGoal)
              }
              className="gap-1.5"
            >
              Toliau <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button type="button" onClick={save} disabled={saving} className="gap-1.5">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Užbaigti ir išsaugoti
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
