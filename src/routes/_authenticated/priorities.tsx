import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ListChecks, Plus, Calendar, Link2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/priorities")({
  component: PrioritiesPage,
});

type Priority = {
  id: string;
  title: string;
  due_date: string | null;
  done: boolean;
  linked_plan_id: string | null;
  linked_goal_id: string | null;
  created_at: string;
};

function PrioritiesPage() {
  const [items, setItems] = useState<Priority[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  async function load() {
    const { data } = await supabase
      .from("priorities")
      .select("id, title, due_date, done, linked_plan_id, linked_goal_id, created_at")
      .order("done", { ascending: true })
      .order("due_date", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false });
    setItems((data as Priority[]) ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function toggle(p: Priority) {
    const next = !p.done;
    setItems((xs) => xs.map((x) => x.id === p.id ? { ...x, done: next } : x));
    const { error } = await supabase.from("priorities").update({ done: next }).eq("id", p.id);
    if (error) { toast.error(error.message); load(); }
  }

  const open_ = items.filter((i) => !i.done);
  const done = items.filter((i) => i.done);

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <header className="border-b bg-background/80 backdrop-blur px-6 py-4 flex items-center gap-3">
        <SidebarTrigger />
        <div className="flex-1">
          <h1 className="font-serif text-2xl leading-tight">Prioritetai</h1>
          <p className="text-sm text-muted-foreground">
            Konkretūs žingsniai iš tavo veiksmų planų. Fokusas — 1–3 dalykai per dieną.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" /> Naujas prioritetas</Button>
          </DialogTrigger>
          <NewPriorityDialog onCreated={() => { setOpen(false); load(); }} />
        </Dialog>
      </header>

      <div className="flex-1 overflow-y-auto p-6 bg-muted/20">
        <div className="max-w-3xl mx-auto space-y-4">
          {loading && <div className="text-sm text-muted-foreground">Kraunama…</div>}
          {!loading && items.length === 0 && (
            <Card className="p-10 text-center border-dashed">
              <div className="h-14 w-14 rounded-2xl bg-primary/10 text-primary mx-auto mb-4 flex items-center justify-center">
                <ListChecks className="h-7 w-7" />
              </div>
              <h2 className="font-serif text-2xl">Dar nėra prioritetų</h2>
              <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
                Užbaik sesiją su „Užbaigti ir suplanuoti" — svarbiausi žingsniai atsiras čia.
              </p>
            </Card>
          )}

          {open_.length > 0 && (
            <section>
              <h2 className="text-xs uppercase tracking-widest text-muted-foreground mb-2">
                Aktyvūs · {open_.length}
              </h2>
              <div className="space-y-2">
                {open_.map((p) => <Row key={p.id} item={p} onToggle={toggle} />)}
              </div>
            </section>
          )}
          {done.length > 0 && (
            <section>
              <h2 className="text-xs uppercase tracking-widest text-muted-foreground mb-2">
                Užbaigti · {done.length}
              </h2>
              <div className="space-y-2 opacity-60">
                {done.map((p) => <Row key={p.id} item={p} onToggle={toggle} />)}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ item, onToggle }: { item: Priority; onToggle: (p: Priority) => void }) {
  return (
    <Card className="p-3 flex items-center gap-3">
      <Checkbox checked={item.done} onCheckedChange={() => onToggle(item)} />
      <div className="flex-1 min-w-0">
        <div className={cn("text-sm font-medium", item.done && "line-through text-muted-foreground")}>
          {item.title}
        </div>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          {item.due_date && (
            <Badge variant="outline" className="text-[10px] gap-1">
              <Calendar className="h-3 w-3" />
              {new Date(item.due_date).toLocaleDateString("lt-LT")}
            </Badge>
          )}
          {item.linked_goal_id && (
            <Badge variant="outline" className="text-[10px] gap-1">
              <Link2 className="h-3 w-3" /> Susietas su tikslu
            </Badge>
          )}
        </div>
      </div>
    </Card>
  );
}

function NewPriorityDialog({ onCreated }: { onCreated: () => void }) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [saving, setSaving] = useState(false);
  async function save() {
    if (!title.trim()) return;
    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    const { error } = await supabase.from("priorities").insert({
      user_id: userData.user.id,
      title: title.trim(),
      due_date: date || null,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Prioritetas išsaugotas");
    setTitle(""); setDate("");
    onCreated();
  }
  return (
    <DialogContent>
      <DialogHeader><DialogTitle className="font-serif text-2xl">Naujas prioritetas</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div>
          <Label>Pavadinimas</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1.5" />
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
