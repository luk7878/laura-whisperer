import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/components/module-placeholder";
import { BookOpen } from "lucide-react";

export const Route = createFileRoute("/_authenticated/journal")({
  component: () => (
    <ModulePlaceholder
      icon={BookOpen}
      title="Augimo žurnalas"
      subtitle="Visų sesijų santraukos ir šablonai."
      description="Kiekviena sesija — puslapis tavo augimo istorijoje. AI generuoja santraukas, išryškina pasikartojančius šablonus ir vertybes."
    />
  ),
});
