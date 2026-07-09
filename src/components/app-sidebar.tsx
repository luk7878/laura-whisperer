import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import {
  Radio,
  Target,
  Eye,
  ListChecks,
  BookOpen,
  Lightbulb,
  BarChart3,
  Library,
  MessageSquare,
  Plus,
  LogOut,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";
import logo from "@/assets/logo.png";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { NewSessionDialog, type SessionMode } from "@/components/new-session-dialog";

const NAV = [
  { title: "Gyva sesija", to: "/session", icon: Radio },
  { title: "Klausk mentoriaus", to: "/ask", icon: MessageSquare },
  { title: "Tikslai", to: "/goals", icon: Target },
  { title: "Vizija", to: "/vision", icon: Eye },
  { title: "Prioritetai", to: "/priorities", icon: ListChecks },
  { title: "Augimo žurnalas", to: "/journal", icon: BookOpen },
  { title: "Įžvalgos", to: "/insights", icon: Lightbulb },
  { title: "Pažanga", to: "/progress", icon: BarChart3 },
] as const;

type RecentSession = { id: string; title: string; updated_at: string; emotional_current: number | null };

export function AppSidebar() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [recent, setRecent] = useState<RecentSession[]>([]);
  const [email, setEmail] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let alive = true;
    supabase.auth.getUser().then(async ({ data }) => {
      if (!alive) return;
      setEmail(data.user?.email ?? null);
      if (data.user) {
        const { data: r } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", data.user.id)
          .eq("role", "admin")
          .maybeSingle();
        if (alive) setIsAdmin(!!r);
      }
    });
    supabase
      .from("sessions")
      .select("id, title, updated_at, emotional_current")
      .order("updated_at", { ascending: false })
      .limit(4)
      .then(({ data }) => alive && setRecent((data as RecentSession[]) ?? []));
    return () => {
      alive = false;
    };
  }, [pathname]);

  const [newOpen, setNewOpen] = useState(false);

  async function createSession(mode: SessionMode) {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    const title =
      mode === "goal_clarify"
        ? "Tikslo išgryninimas"
        : mode === "mentor"
          ? "Klausk mentoriaus"
          : "Nauja sesija";
    const { data, error } = await supabase
      .from("sessions")
      .insert({ user_id: userData.user.id, title, mode })
      .select("id")
      .single();
    if (error) return toast.error(error.message);
    setNewOpen(false);
    navigate({ to: "/session", search: { s: data.id } });
  }

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  }

  const initials = email ? email.slice(0, 2).toUpperCase() : "AK";

  return (
    <Sidebar collapsible="offcanvas" className="border-r">
      <SidebarHeader className="gap-3 p-4">
        <Link to="/session" className="flex items-center gap-2.5">
          <img src={logo} alt="Augimo Kompasas" className="h-9 w-9" />
          <div className="leading-tight">
            <div className="font-serif text-lg text-foreground">Augimo Kompasas</div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">AI palydovas</div>
          </div>
        </Link>
        <Button onClick={() => setNewOpen(true)} className="w-full gap-2 shadow-sm" size="sm">
          <Plus className="h-4 w-4" /> Nauja sesija
        </Button>
        <NewSessionDialog open={newOpen} onOpenChange={setNewOpen} onPick={createSession} />
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] tracking-widest">MANO AUGIMAS</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV.map((n) => {
                const active = pathname === n.to || pathname.startsWith(n.to + "/");
                return (
                  <SidebarMenuItem key={n.to}>
                    <SidebarMenuButton asChild isActive={active} className="h-9">
                      <Link to={n.to} className="flex items-center gap-2.5">
                        <n.icon className={cn("h-4 w-4", active && "text-primary")} />
                        <span>{n.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] tracking-widest">NAUJAUSIOS SESIJOS</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {recent.length === 0 && (
                <div className="px-3 py-2 text-xs text-muted-foreground">Dar nėra sesijų.</div>
              )}
              {recent.slice(0, 3).map((s) => {
                const dot = emotionDot(s.emotional_current);
                return (
                  <SidebarMenuItem key={s.id}>
                    <SidebarMenuButton asChild className="h-9">
                      <Link
                        to="/session"
                        search={{ s: s.id }}
                        className="flex items-center gap-2 text-sm"
                      >
                        <span className={cn("h-2 w-2 rounded-full shrink-0", dot)} />
                        <span className="flex-1 truncate">{s.title}</span>
                        <span className="text-[10px] text-muted-foreground">{relTime(s.updated_at)}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
              {recent.length > 3 && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild className="h-8 text-xs text-muted-foreground">
                    <Link to="/journal" className="flex items-center gap-2">
                      <ChevronRight className="h-3.5 w-3.5" /> Žiūrėti visas sesijas
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-[10px] tracking-widest">ADMIN</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={pathname === "/admin"} className="h-9">
                    <Link to="/admin" className="flex items-center gap-2.5">
                      <ShieldCheck className={cn("h-4 w-4", pathname === "/admin" && "text-primary")} />
                      <span>15 min sesijos</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="p-3">
        <div className="flex items-center gap-2.5 rounded-lg border bg-card p-2.5">
          <Link
            to="/profile"
            className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold hover:bg-primary/20"
            title="Profilis"
          >
            {initials}
          </Link>
          <Link to="/profile" className="flex-1 min-w-0 hover:opacity-80">
            <div className="text-sm font-medium truncate">{email ?? "Vartotojas"}</div>
            <div className="text-[10px] text-muted-foreground">Profilis ir nustatymai</div>
          </Link>
          <button
            onClick={signOut}
            title="Atsijungti"
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

function emotionDot(v: number | null) {
  if (v == null) return "bg-muted-foreground/40";
  if (v >= 8) return "bg-map-rose";
  if (v >= 5) return "bg-map-orange";
  if (v >= 3) return "bg-map-teal";
  return "bg-map-green";
}

function relTime(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 60000;
  if (diff < 60) return `Prieš ${Math.max(1, Math.round(diff))} min.`;
  if (diff < 60 * 24) return `Prieš ${Math.round(diff / 60)} val.`;
  const days = Math.round(diff / 60 / 24);
  if (days === 1) return "Vakar";
  return `Prieš ${days} d.`;
}
