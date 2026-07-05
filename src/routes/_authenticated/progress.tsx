import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/components/module-placeholder";
import { BarChart3 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/progress")({
  component: () => (
    <ModulePlaceholder
      icon={BarChart3}
      title="Pažanga"
      subtitle="Emocinis palengvėjimas per laiką."
      description="Kreivės ir grafikai iš visų tavo sesijų — kaip keitėsi emocinis krūvis, kiek sesijų per mėnesį, vidutinis pokytis."
    />
  ),
});
