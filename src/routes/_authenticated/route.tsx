import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
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
  return (
    <SidebarProvider>
      <div className="flex min-h-[100dvh] w-full bg-background overflow-x-hidden">
        <AppSidebar />
        <div className="flex-1 min-w-0 flex flex-col pb-[calc(64px+env(safe-area-inset-bottom))] md:pb-0">
          <Outlet />
        </div>
        <MobileBottomNav />
      </div>
    </SidebarProvider>
  );
}
