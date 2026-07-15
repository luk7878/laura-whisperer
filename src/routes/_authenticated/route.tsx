import { createFileRoute, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { MobileBottomNav } from "@/components/mobile-bottom-nav";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthedLayout,
});

function AuthedLayout() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const pinnedWorkspace =
    pathname === "/ask" || pathname.startsWith("/ask/") || pathname === "/session";
  // Mentoriaus lange pagrindinė navigacija lieka matoma. Pilno fokusavimo
  // režimą naudojame tik gyvai sesijai, kur svarbus maksimalus darbo plotas.
  const focusMode = pathname === "/session";
  const [sidebarOpen, setSidebarOpen] = useState(!focusMode);

  useEffect(() => {
    setSidebarOpen(!focusMode);
  }, [focusMode]);

  return (
    <SidebarProvider open={sidebarOpen} onOpenChange={setSidebarOpen}>
      <div
        className={`flex w-full bg-transparent ${
          pinnedWorkspace ? "h-[100dvh] overflow-hidden" : "min-h-[100dvh] overflow-x-hidden"
        }`}
      >
        <AppSidebar />
        <div className="flex-1 min-w-0 flex flex-col pb-[calc(64px+env(safe-area-inset-bottom))] md:pb-0">
          <Outlet />
        </div>
        <MobileBottomNav />
      </div>
    </SidebarProvider>
  );
}
