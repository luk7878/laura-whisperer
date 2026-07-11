import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Sparkles } from "lucide-react";
import { Link } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";

export function ModulePlaceholder({
  icon: Icon,
  title,
  subtitle,
  description,
}: {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  description: string;
}) {
  return (
    <div className="flex-1 flex flex-col min-w-0">
      <header className="app-page-header">
        <SidebarTrigger />
        <div>
          <h1 className="font-serif text-2xl leading-tight">{title}</h1>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
      </header>

      <div className="app-page-body flex items-center justify-center p-8">
        <Card className="max-w-lg p-10 text-center">
          <div className="h-16 w-16 rounded-2xl bg-primary/10 text-primary mx-auto flex items-center justify-center mb-5">
            <Icon className="h-8 w-8" />
          </div>
          <h2 className="font-serif text-3xl mb-3">{title}</h2>
          <p className="text-muted-foreground leading-relaxed">{description}</p>
          <div className="flex items-center justify-center gap-2 mt-6 text-xs text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Modulis kuriamas — netrukus bus prieinamas.
          </div>
          <Button asChild variant="outline" className="mt-6">
            <Link to="/session">Grįžti į gyvą sesiją</Link>
          </Button>
        </Card>
      </div>
    </div>
  );
}
