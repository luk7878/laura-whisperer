import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/components/module-placeholder";
import { Lightbulb } from "lucide-react";

export const Route = createFileRoute("/_authenticated/insights")({
  component: () => (
    <ModulePlaceholder
      icon={Lightbulb}
      title="Įžvalgos"
      subtitle="Savaitinės AI įžvalgos apie tavo augimą."
      description="Automatinės savaitinės ataskaitos: kokios temos kartojasi, kurios vertybės aktyviausios, kur atsiranda proveržis."
    />
  ),
});
