import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
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
import { Target, Plus, Calendar, Link2, Sparkles } from "lucide-react";
import { toast } from "sonner";

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

function GoalsPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  async function load() {
    const { data } = await supabase
      .from("goals")
      .select("id, title, description, target_date, status, progress, linked_plan_id, created_at")
      .order("created_at", { ascending: false });
    setGoals((data as Goal[]) ?? []);
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <header className="border-b bg-background/80 backdrop-blur px-6 py-4 flex items-center gap-3">
        <SidebarTrigger />
        <div className="flex-1">
          <h1 className="font-serif text-2xl leading-tight">Tikslai</h1>
          <p className="text-sm text-muted-foreground">
            Tavo augimo kryptys. Kiekvienas tikslas gali kilti iš gyvos sesijos.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" /> Naujas tikslas
            </Button>
          </DialogTrigger>
          <NewGoalDialog onCreated={() => { setOpen(false); load(); }} />
        </Dialog>
      </header>

      <div className="flex-1 overflow-y-auto p-6 bg-muted/20">
        <div className="max-w-4xl mx-auto space-y-3">
          {loading && <div className="text-sm text-muted-foreground">Kraunama…</div>}
          {!loading && goals.length === 0 && (
            <Card className="p-10 text-center border-dashed">
              <div className="h-14 w-14 rounded-2xl bg-primary/10 text-primary mx-auto mb-4 flex items-center justify-center">
                <Target className="h-7 w-7" />
              </div>
              <h2 className="font-serif text-2xl">Dar nėra tikslų</h2>
              <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
                Užbaik sesiją su „Užbaigti ir suplanuoti" — tikslas atsiras automatiškai. Arba
                sukurk rankiniu būdu.
              </p>
              <Button asChild variant="outline" className="mt-5">
                <Link to="/session">
                  <Sparkles className="h-4 w-4 mr-1.5" /> Pradėti sesiją
                </Link>
              </Button>
            </Card>
          )}
          {goals.map((g) => (
            <Card key={g.id} className="p-4">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Target className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-medium">{g.title}</h3>
                    <Badge variant="outline" className="text-[10px]">
                      {g.status === "active" ? "Aktyvus" : g.status}
                    </Badge>
                    {g.linked_plan_id && (
                      <Badge variant="outline" className="text-[10px] gap-1">
                        <Link2 className="h-3 w-3" /> Iš plano
                      </Badge>
                    )}
                  </div>
                  {g.description && (
                    <p className="text-sm text-muted-foreground mt-1">{g.description}</p>
                  )}
                  <div className="mt-2 flex items-center gap-3">
                    <Progress value={g.progress} className="h-1.5 flex-1" />
                    <span className="text-xs text-muted-foreground">{g.progress}%</span>
                    {g.target_date && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(g.target_date).toLocaleDateString("lt-LT")}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
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
    setTitle(""); setDesc(""); setDate("");
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
          <Textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={3} className="mt-1.5" />
        </div>
        <div>
          <Label>Terminas</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1.5 w-52" />
        </div>
      </div>
      <DialogFooter>
        <Button onClick={save} disabled={saving || !title.trim()}>Išsaugoti</Button>
      </DialogFooter>
    </DialogContent>
  );
}
