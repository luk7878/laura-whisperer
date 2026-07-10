import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Radio,
  MessageSquare,
  Target,
  BookOpen,
  MoreHorizontal,
  Eye,
  ListChecks,
  Lightbulb,
  BarChart3,
  User,
  ShieldCheck,
  Library,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetClose,
} from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const PRIMARY = [
  { title: "Sesija", to: "/session", icon: Radio },
  { title: "Mentorius", to: "/ask", icon: MessageSquare },
  { title: "Tikslai", to: "/goals", icon: Target },
  { title: "Žurnalas", to: "/journal", icon: BookOpen },
] as const;

const MORE = [
  { title: "Vizija", to: "/vision", icon: Eye },
  { title: "Prioritetai", to: "/priorities", icon: ListChecks },
  { title: "Įžvalgos", to: "/insights", icon: Lightbulb },
  { title: "Pažanga", to: "/progress", icon: BarChart3 },
  { title: "Profilis", to: "/profile", icon: User },
] as const;

const ADMIN_MORE = [
  { title: "15 min sesijos", to: "/admin", icon: ShieldCheck },
  { title: "Žinių bazė", to: "/knowledge", icon: Library },
] as const;

export function MobileBottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let alive = true;
    supabase.auth.getUser().then(async ({ data }) => {
      if (!alive || !data.user) return;
      const { data: r } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", data.user.id)
        .eq("role", "admin")
        .maybeSingle();
      if (alive) setIsAdmin(!!r);
    });
    return () => {
      alive = false;
    };
  }, []);

  const isActive = (to: string) => pathname === to || pathname.startsWith(to + "/");
  const moreActive = MORE.some((m) => isActive(m.to)) || ADMIN_MORE.some((m) => isActive(m.to));

  return (
    <>
      <nav
        aria-label="Mobili navigacija"
        className={cn(
          "md:hidden fixed inset-x-0 bottom-0 z-40",
          "bg-background/95 backdrop-blur border-t",
          "pb-[env(safe-area-inset-bottom)]",
        )}
      >
        <ul className="grid grid-cols-5">
          {PRIMARY.map((n) => {
            const active = isActive(n.to);
            return (
              <li key={n.to}>
                <Link
                  to={n.to}
                  className={cn(
                    "flex flex-col items-center justify-center gap-0.5 py-2 min-h-[56px] text-[10px] font-medium",
                    "transition-colors focus-visible:outline-none focus-visible:bg-accent",
                    active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <n.icon className={cn("h-5 w-5", active && "text-primary")} />
                  <span className="leading-none">{n.title}</span>
                </Link>
              </li>
            );
          })}
          <li>
            <button
              type="button"
              onClick={() => setOpen(true)}
              className={cn(
                "w-full flex flex-col items-center justify-center gap-0.5 py-2 min-h-[56px] text-[10px] font-medium",
                "transition-colors focus-visible:outline-none focus-visible:bg-accent",
                moreActive ? "text-primary" : "text-muted-foreground hover:text-foreground",
              )}
              aria-label="Daugiau"
            >
              <MoreHorizontal className={cn("h-5 w-5", moreActive && "text-primary")} />
              <span className="leading-none">Daugiau</span>
            </button>
          </li>
        </ul>
      </nav>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          className="rounded-t-2xl p-0 max-h-[85dvh] pb-[env(safe-area-inset-bottom)]"
        >
          <SheetHeader className="p-4 border-b">
            <SheetTitle className="text-left font-serif text-lg">Daugiau</SheetTitle>
          </SheetHeader>
          <div className="p-2 overflow-y-auto">
            <ul className="grid grid-cols-1">
              {MORE.map((m) => {
                const active = isActive(m.to);
                return (
                  <li key={m.to}>
                    <SheetClose asChild>
                      <Link
                        to={m.to}
                        className={cn(
                          "flex items-center gap-3 px-3 py-3 rounded-lg text-sm min-h-[48px]",
                          "hover:bg-accent transition-colors",
                          active && "bg-accent text-primary font-medium",
                        )}
                      >
                        <m.icon className="h-5 w-5 shrink-0" />
                        <span className="flex-1">{m.title}</span>
                      </Link>
                    </SheetClose>
                  </li>
                );
              })}
              {isAdmin && (
                <>
                  <li className="px-3 py-2 mt-2 text-[10px] uppercase tracking-widest text-muted-foreground">
                    Admin
                  </li>
                  {ADMIN_MORE.map((m) => {
                    const active = isActive(m.to);
                    return (
                      <li key={m.to}>
                        <SheetClose asChild>
                          <Link
                            to={m.to}
                            className={cn(
                              "flex items-center gap-3 px-3 py-3 rounded-lg text-sm min-h-[48px]",
                              "hover:bg-accent transition-colors",
                              active && "bg-accent text-primary font-medium",
                            )}
                          >
                            <m.icon className="h-5 w-5 shrink-0" />
                            <span className="flex-1">{m.title}</span>
                          </Link>
                        </SheetClose>
                      </li>
                    );
                  })}
                </>
              )}
            </ul>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
