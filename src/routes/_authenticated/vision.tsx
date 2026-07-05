import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/components/module-placeholder";
import { Eye } from "lucide-react";

export const Route = createFileRoute("/_authenticated/vision")({
  component: () => (
    <ModulePlaceholder
      icon={Eye}
      title="Vizija"
      subtitle="5, 10 ir 20 metų kryptys."
      description="Trys kortelės — trys horizontai. AI padės formuluoti viziją, kuri išplaukia iš tavo vertybių, ir susieti ją su kasdieniais žingsniais."
    />
  ),
});
