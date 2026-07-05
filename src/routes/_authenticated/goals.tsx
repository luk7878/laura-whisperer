import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/components/module-placeholder";
import { Target } from "lucide-react";

export const Route = createFileRoute("/_authenticated/goals")({
  component: () => (
    <ModulePlaceholder
      icon={Target}
      title="Tikslai"
      subtitle="Kelk tikslus, suderintus su tavo tikromis vertybėmis."
      description="Šis modulis padės tau formuluoti tikslus pagal Demartini vertybių hierarchiją — kad tikslai kiltų iš vidaus, o ne iš pasiskolintų lūkesčių. Kiekvieną tikslą galėsi aptarti su AI vedliu."
    />
  ),
});
