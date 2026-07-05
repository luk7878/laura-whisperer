import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/components/module-placeholder";
import { ListChecks } from "lucide-react";

export const Route = createFileRoute("/_authenticated/priorities")({
  component: () => (
    <ModulePlaceholder
      icon={ListChecks}
      title="Prioritetai"
      subtitle="Dienos ir savaitės žingsniai."
      description="Susiek kasdienius veiksmus su aukščiausiomis vertybėmis ir tikslais. AI padės atskirti tikruosius prioritetus nuo triukšmo."
    />
  ),
});
