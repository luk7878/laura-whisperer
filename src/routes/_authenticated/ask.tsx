import { createFileRoute, Link, Outlet, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet";
import { MessageSquare, Library, Plus, Loader2, Trash2, PanelLeft, Gem, Bot } from "lucide-react";
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
  const [sheetOpen, setSheetOpen] = useState(false);
  const [valuesCount, setValuesCount] = useState(0);
  const [agentActive, setAgentActive] = useState(false);

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
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;
      const [{ count }, { data: settings }, { data: entitlement }] = await Promise.all([
        supabase.from("values").select("id", { count: "exact", head: true }).lt("rank", 100),
        supabase
          .from("agent_settings")
          .select("enabled")
          .eq("user_id", userData.user.id)
          .maybeSingle(),
        supabase
          .from("feature_entitlements")
          .select("active,expires_at")
          .eq("user_id", userData.user.id)
          .eq("feature_key", "growth_agent")
          .maybeSingle(),
      ]);
      setValuesCount(count ?? 0);
      setAgentActive(
        !!settings?.enabled &&
          !!entitlement?.active &&
          (!entitlement.expires_at || new Date(entitlement.expires_at).getTime() > Date.now()),
      );
    })();
  }, []);

  useEffect(() => {
    load();
    const ch = supabase
      .channel("mentor_threads_ch")
      .on("postgres_changes", { event: "*", schema: "public", table: "mentor_threads" }, () =>
        load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  async function createNew() {
    setSheetOpen(false);
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

  function openThread(id: string) {
    setSheetOpen(false);
    navigate({ to: "/ask/$threadId", params: { threadId: id } });
  }

  const ThreadList = (
    <div className="flex-1 overflow-y-auto p-2 space-y-1">
      {loading && (
        <div className="text-xs text-muted-foreground p-2">
          <Loader2 className="h-3 w-3 animate-spin inline mr-1" /> Kraunama…
        </div>
      )}
      {!loading && threads.length === 0 && (
        <p className="text-xs text-muted-foreground p-2">Dar nėra pokalbių.</p>
      )}
      {threads.map((t) => (
        <div
          key={t.id}
          onClick={() => openThread(t.id)}
          className={cn(
            "group flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm cursor-pointer hover:bg-accent transition-colors",
            activeId === t.id && "bg-accent",
          )}
        >
          <MessageSquare className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="flex-1 truncate">{t.title}</span>
          <button
            onClick={(e) => remove(t.id, e)}
            className="opacity-60 md:opacity-0 md:group-hover:opacity-100 p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition"
            aria-label="Ištrinti"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-transparent">
      <header className="app-page-header relative z-20 shrink-0 py-2.5 md:py-3">
        <SidebarTrigger className="shrink-0" />
        <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary to-map-violet text-white shadow-md flex items-center justify-center shrink-0">
          <MessageSquare className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="font-serif text-base md:text-lg leading-tight truncate">
            Klausk mentoriaus
          </h1>
          <p className="text-[10px] md:text-[11px] text-muted-foreground truncate">
            {valuesCount > 0
              ? `Žinių bazė + tavo TOP ${Math.min(valuesCount, 5)} vertybės`
              : "Atsakymai iš tavo įkeltos medžiagos"}
          </p>
        </div>

        {agentActive && (
          <div className="hidden items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-2.5 py-1 text-[11px] font-semibold text-primary sm:flex">
            <Bot className="h-3.5 w-3.5" /> Agentas aktyvus
          </div>
        )}

        {valuesCount > 0 && (
          <Button asChild variant="ghost" size="sm" className="hidden gap-1.5 lg:inline-flex">
            <Link to="/values">
              <Gem className="h-3.5 w-3.5" /> Vertybių kontekstas
            </Link>
          </Button>
        )}

        {/* Pokalbių istorija atidaroma pareikalavus, kad nekonkuruotų su pagrindine navigacija. */}
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-9 shrink-0 gap-1.5 px-2 md:px-3"
              title="Pokalbiai"
            >
              <PanelLeft className="h-4 w-4" />
              <span className="hidden lg:inline">Pokalbiai</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[85vw] max-w-xs p-0 flex flex-col">
            <SheetHeader className="p-3 border-b">
              <SheetTitle className="text-left font-serif text-lg">Pokalbiai</SheetTitle>
            </SheetHeader>
            <div className="p-3 border-b">
              <SheetClose asChild>
                <Button onClick={createNew} className="w-full gap-2" size="sm">
                  <Plus className="h-4 w-4" /> Naujas pokalbis
                </Button>
              </SheetClose>
            </div>
            {ThreadList}
          </SheetContent>
        </Sheet>

        <Button asChild variant="outline" size="sm" className="gap-1.5 h-9 px-2 md:px-3 shrink-0">
          <Link to="/knowledge">
            <Library className="h-3.5 w-3.5" />
            <span className="hidden md:inline">Žinių bazė</span>
          </Link>
        </Button>
      </header>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
