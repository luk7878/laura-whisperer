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

type RecentSession = {
  id: string;
  title: string;
  updated_at: string;
  emotional_current: number | null;
};

export function AppSidebar() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [recent, setRecent] = useState<RecentSession[]>([]);
  const [email, setEmail] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const adminArea =
    pathname === "/admin" || pathname.startsWith("/admin/") || pathname === "/knowledge";
  const mentorArea = pathname === "/ask" || pathname.startsWith("/ask/");

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
    <Sidebar
      collapsible="offcanvas"
      className="border-r border-sidebar-border/70 bg-sidebar/90 backdrop-blur-xl"
    >
      <SidebarHeader className="gap-4 px-4 pb-3 pt-5">
        <Link
          to={adminArea ? "/admin" : "/session"}
          className="group flex items-center gap-3 rounded-xl px-1 py-1"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 to-map-violet/10 ring-1 ring-primary/10 transition-transform group-hover:scale-105">
            <img src={logo} alt="Augimo Kompasas" className="h-7 w-7" />
          </div>
          <div className="leading-tight">
            <div className="font-serif text-xl tracking-[-0.01em] text-foreground">
              Augimo Kompasas
            </div>
            <div className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              AI palydovas
            </div>
          </div>
        </Link>
        {adminArea ? (
          <div className="rounded-xl border border-primary/15 bg-primary/[0.06] px-3 py-3">
            <div className="flex items-center gap-2 text-sm font-medium text-primary">
              <ShieldCheck className="h-4 w-4" /> Administravimas
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">Valdymo aplinka</p>
          </div>
        ) : (
          <>
            <Button onClick={() => setNewOpen(true)} className="h-11 w-full gap-2" size="sm">
              <Plus className="h-4 w-4" /> Nauja sesija
            </Button>
            <NewSessionDialog open={newOpen} onOpenChange={setNewOpen} onPick={createSession} />
          </>
        )}
      </SidebarHeader>

      <SidebarContent>
        {!adminArea && (
          <SidebarGroup className="px-3 py-2">
            <SidebarGroupLabel className="px-2 text-[10px] font-semibold tracking-[0.2em] text-muted-foreground/80">
              MANO AUGIMAS
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {NAV.map((n) => {
                  const active = pathname === n.to || pathname.startsWith(n.to + "/");
                  return (
                    <SidebarMenuItem key={n.to}>
                      <SidebarMenuButton
                        asChild
                        isActive={active}
                        className="h-10 rounded-xl px-3 text-[13px] font-medium transition-all data-[active=true]:bg-sidebar-accent data-[active=true]:shadow-[inset_0_0_0_1px_oklch(0.535_0.205_274_/_0.08)]"
                      >
                        <Link to={n.to} className="flex items-center gap-3">
                          <span
                            className={cn(
                              "flex h-7 w-7 items-center justify-center rounded-lg transition-colors",
                              active
                                ? "bg-primary text-primary-foreground shadow-sm"
                                : "text-muted-foreground",
                            )}
                          >
                            <n.icon className="h-4 w-4" />
                          </span>
                          <span>{n.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {!adminArea && !mentorArea && (
          <SidebarGroup className="px-3 py-2">
            <SidebarGroupLabel className="px-2 text-[10px] font-semibold tracking-[0.2em] text-muted-foreground/80">
              NAUJAUSIOS SESIJOS
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {recent.length === 0 && (
                  <div className="px-3 py-2 text-xs text-muted-foreground">Dar nėra sesijų.</div>
                )}
                {recent.slice(0, 3).map((s) => {
                  const dot = emotionDot(s.emotional_current);
                  return (
                    <SidebarMenuItem key={s.id}>
                      <SidebarMenuButton asChild className="h-10 rounded-xl px-3">
                        <Link
                          to="/session"
                          search={{ s: s.id }}
                          className="flex items-center gap-2 text-sm"
                        >
                          <span className={cn("h-2 w-2 rounded-full shrink-0", dot)} />
                          <span className="flex-1 truncate">{s.title}</span>
                          <span className="text-[10px] text-muted-foreground">
                            {relTime(s.updated_at)}
                          </span>
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
        )}

        {isAdmin && (
          <SidebarGroup className="px-3 py-2">
            <SidebarGroupLabel className="px-2 text-[10px] font-semibold tracking-[0.2em] text-muted-foreground/80">
              {adminArea ? "ADMINISTRAVIMAS" : "ADMIN"}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={pathname === "/admin"} className="h-9">
                    <Link to="/admin" className="flex items-center gap-2.5">
                      <ShieldCheck
                        className={cn("h-4 w-4", pathname === "/admin" && "text-primary")}
                      />
                      <span>15 min sesijos</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                {adminArea && (
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild className="h-9 text-muted-foreground">
                      <Link to="/session" className="flex items-center gap-2.5">
                        <ChevronRight className="h-4 w-4 rotate-180" />
                        <span>Grįžti į vartotojo aplinką</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )}
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={pathname === "/knowledge"} className="h-9">
                    <Link to="/knowledge" className="flex items-center gap-2.5">
                      <Library
                        className={cn("h-4 w-4", pathname === "/knowledge" && "text-primary")}
                      />
                      <span>Žinių bazė</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="p-3">
        <div className="flex items-center gap-2.5 rounded-2xl border border-white/80 bg-card/85 p-2.5 shadow-[0_10px_30px_-24px_oklch(0.25_0.08_270)] backdrop-blur">
          {adminArea ? (
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium">Administratorius</div>
              <div className="text-[10px] text-muted-foreground truncate">
                {email ?? "Admin paskyra"}
              </div>
            </div>
          ) : (
            <>
              <Link
                to="/profile"
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-map-violet text-xs font-semibold text-white shadow-md transition-transform hover:scale-105"
                title="Profilis"
              >
                {initials}
              </Link>
              <Link to="/profile" className="flex-1 min-w-0 hover:opacity-80">
                <div className="text-sm font-medium truncate">{email ?? "Vartotojas"}</div>
                <div className="text-[10px] text-muted-foreground">Profilis ir nustatymai</div>
              </Link>
            </>
          )}
          <button
            onClick={signOut}
            title="Atsijungti"
            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
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
