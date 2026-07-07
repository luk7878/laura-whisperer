import { createFileRoute, Link, Outlet, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { MessageSquare, Library, Plus, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/ask")({
  component: AskLayout,
});

type Thread = { id: string; title: string; updated_at: string };

function AskLayout() {
  const navigate = useNavigate();
  const params = useParams({ strict: false }) as { threadId?: string };
  const activeId = params.threadId;
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    const { data, error } = await supabase
      .from("mentor_threads")
      .select("id,title,updated_at")
      .order("updated_at", { ascending: false });
    if (error) toast.error(error.message);
    setThreads(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    const ch = supabase
      .channel("mentor_threads_ch")
      .on("postgres_changes", { event: "*", schema: "public", table: "mentor_threads" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  async function createNew() {
    navigate({ to: "/ask" });
  }

  async function remove(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm("Ištrinti šį pokalbį?")) return;
    const { error } = await supabase.from("mentor_threads").delete().eq("id", id);
    if (error) return toast.error(error.message);
    if (activeId === id) navigate({ to: "/ask" });
    load();
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-gradient-to-b from-background to-muted/30">
      <header className="border-b bg-background/80 backdrop-blur px-4 md:px-6 py-3 flex items-center gap-3">
        <SidebarTrigger />
        <div className="h-8 w-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
          <MessageSquare className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="font-serif text-lg leading-tight">Klausk mentoriaus</h1>
          <p className="text-[11px] text-muted-foreground">Atsakymai iš tavo įkeltos medžiagos</p>
        </div>
        <Button asChild variant="outline" size="sm" className="gap-2">
          <Link to="/knowledge"><Library className="h-3.5 w-3.5" /> Žinių bazė</Link>
        </Button>
      </header>

      <div className="flex-1 min-h-0 flex">
        {/* Thread list */}
        <aside className="hidden md:flex w-64 shrink-0 border-r flex-col bg-background/50">
          <div className="p-3 border-b">
            <Button onClick={createNew} className="w-full gap-2" size="sm">
              <Plus className="h-4 w-4" /> Naujas pokalbis
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {loading && <div className="text-xs text-muted-foreground p-2"><Loader2 className="h-3 w-3 animate-spin inline mr-1" /> Kraunama…</div>}
            {!loading && threads.length === 0 && (
              <p className="text-xs text-muted-foreground p-2">Dar nėra pokalbių.</p>
            )}
            {threads.map((t) => (
              <div
                key={t.id}
                onClick={() => navigate({ to: "/ask/$threadId", params: { threadId: t.id } })}
                className={cn(
                  "group flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs cursor-pointer hover:bg-accent transition-colors",
                  activeId === t.id && "bg-accent",
                )}
              >
                <MessageSquare className="h-3 w-3 shrink-0 text-muted-foreground" />
                <span className="flex-1 truncate">{t.title}</span>
                <button
                  onClick={(e) => remove(t.id, e)}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition"
                  aria-label="Ištrinti"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        </aside>

        {/* Mobile thread bar */}
        <div className="md:hidden absolute top-14 left-0 right-0 z-10 border-b bg-background/95 backdrop-blur px-3 py-2 flex gap-2 overflow-x-auto">
          <Button onClick={createNew} size="sm" variant="outline" className="gap-1 shrink-0 h-8">
            <Plus className="h-3.5 w-3.5" /> Naujas
          </Button>
          {threads.slice(0, 10).map((t) => (
            <Button
              key={t.id}
              size="sm"
              variant={activeId === t.id ? "secondary" : "ghost"}
              className="shrink-0 h-8 text-xs max-w-[140px]"
              onClick={() => navigate({ to: "/ask/$threadId", params: { threadId: t.id } })}
            >
              <span className="truncate">{t.title}</span>
            </Button>
          ))}
        </div>

        <main className="flex-1 min-w-0 flex flex-col pt-12 md:pt-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
