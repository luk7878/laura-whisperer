import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Target,
  Flag,
  Compass,
  BookOpen,
  Loader2,
  Plus,
  Link2,
  Sparkles,
} from "lucide-react";
import { useNavigate } from "@tanstack/react-router";

export type IntegrationSession = {
  id: string;
  title: string;
  active_topic: string | null;
  active_belief: string | null;
  active_column: string | null;
  emotional_current: number | null;
  patterns: string[] | null;
};

type Goal = { id: string; title: string; description: string | null; progress: number; status: string };
type Priority = { id: string; title: string; done: boolean };
type Vision = { id: string; content: string; horizon_years: number };

export function SessionIntegration({
  session,
  lastInsight,
}: {
  session: IntegrationSession;
  lastInsight?: string;
}) {
  const navigate = useNavigate();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [priorities, setPriorities] = useState<Priority[]>([]);
  const [vision, setVision] = useState<Vision[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const defaultInsight = [
    session.active_topic ? `Tema: ${session.active_topic}` : null,
    session.active_belief ? `Įsitikinimas: ${session.active_belief}` : null,
    session.active_column ? `Etapas: ${session.active_column}` : null,
    lastInsight ? `Įžvalga: ${lastInsight}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const [insightText, setInsightText] = useState(defaultInsight);
  const [selectedGoal, setSelectedGoal] = useState<string>("");
  const [priorityTitle, setPriorityTitle] = useState<string>(
    session.active_topic ? `Veiksmas: ${session.active_topic}` : "",
  );

  useEffect(() => {
    setInsightText(defaultInsight);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.id, lastInsight, session.active_topic, session.active_belief]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [{ data: g }, { data: p }, { data: v }] = await Promise.all([
        supabase.from("goals").select("id,title,description,progress,status").order("created_at", { ascending: false }),
        supabase.from("priorities").select("id,title,done").eq("done", false).order("created_at", { ascending: false }).limit(20),
        supabase.from("vision").select("id,content,horizon_years").order("horizon_years", { ascending: true }),
      ]);
      setGoals((g as Goal[]) ?? []);
      setPriorities((p as Priority[]) ?? []);
      setVision((v as Vision[]) ?? []);
      setLoading(false);
    })();
  }, [session.id]);

  async function saveJournal() {
    if (!insightText.trim()) return toast.error("Nėra ką išsaugoti");
    setSaving(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Nesi prisijungęs");
      const { error } = await supabase.from("journal_entries").insert({
        user_id: u.user.id,
        session_id: session.id,
        summary: insightText.trim(),
        patterns: (session.patterns ?? []) as unknown as never,
      });
      if (error) throw error;
      toast.success("Įžvalga išsaugota į dienoraštį");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Nepavyko išsaugoti");
    } finally {
      setSaving(false);
    }
  }

  async function linkToGoal() {
    if (!selectedGoal) return toast.error("Pasirink tikslą");
    if (!insightText.trim()) return toast.error("Nėra įžvalgos");
    setSaving(true);
    try {
      const goal = goals.find((g) => g.id === selectedGoal);
      if (!goal) throw new Error("Tikslas nerastas");
      const stamp = new Date().toLocaleDateString("lt-LT");
      const addition = `\n\n— Sesijos įžvalga (${stamp}) —\n${insightText.trim()}`;
      const newDesc = (goal.description ?? "") + addition;
      const { error } = await supabase.from("goals").update({ description: newDesc }).eq("id", goal.id);
      if (error) throw error;
      setGoals((gs) => gs.map((g) => (g.id === goal.id ? { ...g, description: newDesc } : g)));
      toast.success("Susieta su tikslu");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Nepavyko susieti");
    } finally {
      setSaving(false);
    }
  }

  async function createGoalFromSession() {
    if (!session.active_topic) return toast.error("Sesija dar neturi temos");
    setSaving(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Nesi prisijungęs");
      const { data, error } = await supabase
        .from("goals")
        .insert({
          user_id: u.user.id,
          title: session.active_topic.slice(0, 200),
          description: insightText.trim() || null,
        })
        .select("id,title,description,progress,status")
        .single();
      if (error) throw error;
      setGoals((gs) => [data as Goal, ...gs]);
      toast.success("Naujas tikslas sukurtas");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Nepavyko sukurti");
    } finally {
      setSaving(false);
    }
  }

  async function createPriority() {
    const title = priorityTitle.trim();
    if (!title) return toast.error("Įrašyk veiksmą");
    setSaving(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Nesi prisijungęs");
      const due = new Date();
      due.setDate(due.getDate() + 3);
      const { data, error } = await supabase
        .from("priorities")
        .insert({
          user_id: u.user.id,
          title: title.slice(0, 200),
          due_date: due.toISOString().slice(0, 10),
          linked_goal_id: selectedGoal || null,
        })
        .select("id,title,done")
        .single();
      if (error) throw error;
      setPriorities((ps) => [data as Priority, ...ps]);
      setPriorityTitle("");
      toast.success("Prioritetas pridėtas");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Nepavyko pridėti");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-3 md:px-6 py-4 md:py-6 space-y-4">
      {/* Insight card */}
      <Card className="p-4 md:p-5">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="h-4 w-4 text-primary" />
          <h3 className="font-serif text-lg">Sesijos įžvalga</h3>
        </div>
        {session.patterns && session.patterns.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {session.patterns.map((p, i) => (
              <Badge key={i} variant="secondary" className="text-xs">
                {p}
              </Badge>
            ))}
          </div>
        )}
        <Textarea
          value={insightText}
          onChange={(e) => setInsightText(e.target.value)}
          rows={4}
          placeholder="Aprašyk, ką supratai per šią sesiją…"
          className="mb-3"
        />
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={saveJournal} disabled={saving}>
            <BookOpen className="h-4 w-4 mr-1.5" />
            Įrašyti į dienoraštį
          </Button>
        </div>
      </Card>

      {/* Link to goals */}
      <Card className="p-4 md:p-5">
        <div className="flex items-center gap-2 mb-3">
          <Target className="h-4 w-4 text-primary" />
          <h3 className="font-serif text-lg">Susieti su tikslu</h3>
        </div>
        {loading ? (
          <div className="text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Kraunama…
          </div>
        ) : goals.length === 0 ? (
          <p className="text-sm text-muted-foreground mb-3">
            Dar neturi tikslų. Sukurk pirmą iš šios sesijos.
          </p>
        ) : (
          <div className="space-y-2 mb-3">
            <Select value={selectedGoal} onValueChange={setSelectedGoal}>
              <SelectTrigger>
                <SelectValue placeholder="Pasirink tikslą…" />
              </SelectTrigger>
              <SelectContent>
                {goals.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={linkToGoal} disabled={saving || !selectedGoal}>
            <Link2 className="h-4 w-4 mr-1.5" />
            Prisegti įžvalgą prie tikslo
          </Button>
          <Button size="sm" variant="outline" onClick={createGoalFromSession} disabled={saving || !session.active_topic}>
            <Plus className="h-4 w-4 mr-1.5" />
            Naujas tikslas iš sesijos
          </Button>
          <Button size="sm" variant="ghost" onClick={() => navigate({ to: "/goals" })}>
            Atverti tikslus
          </Button>
        </div>
      </Card>

      {/* Priorities */}
      <Card className="p-4 md:p-5">
        <div className="flex items-center gap-2 mb-3">
          <Flag className="h-4 w-4 text-primary" />
          <h3 className="font-serif text-lg">Paversti į prioritetą</h3>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 mb-3">
          <input
            value={priorityTitle}
            onChange={(e) => setPriorityTitle(e.target.value)}
            placeholder="Vienas veiksmas per artimiausias 3 dienas…"
            className="flex-1 h-10 rounded-md border border-input bg-background px-3 text-sm"
          />
          <Button size="sm" onClick={createPriority} disabled={saving || !priorityTitle.trim()}>
            <Plus className="h-4 w-4 mr-1.5" />
            Pridėti
          </Button>
        </div>
        {priorities.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground">Aktyvūs prioritetai:</p>
            {priorities.slice(0, 5).map((p) => (
              <div key={p.id} className="text-sm flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-primary/60" />
                <span className="truncate">{p.title}</span>
              </div>
            ))}
          </div>
        )}
        <div className="mt-3">
          <Button size="sm" variant="ghost" onClick={() => navigate({ to: "/priorities" })}>
            Atverti prioritetus
          </Button>
        </div>
      </Card>

      {/* Vision */}
      <Card className="p-4 md:p-5">
        <div className="flex items-center gap-2 mb-3">
          <Compass className="h-4 w-4 text-primary" />
          <h3 className="font-serif text-lg">Vizija</h3>
        </div>
        {loading ? null : vision.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Dar neaprašei savo vizijos. Ji padeda sesijos įžvalgas surišti su ilgalaikiu kryptimi.
          </p>
        ) : (
          <div className="space-y-2">
            {vision.slice(0, 3).map((v) => (
              <div key={v.id} className="text-sm">
                <div className="text-xs text-muted-foreground mb-0.5">Po {v.horizon_years} m.</div>
                <p className="line-clamp-3">{v.content}</p>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
