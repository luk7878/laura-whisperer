import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/components/module-placeholder";
import { Library } from "lucide-react";

export const Route = createFileRoute("/_authenticated/resources")({
  component: () => (
    <ModulePlaceholder
      icon={Library}
      title="Resursai"
      subtitle="Demartini metodo pagrindai."
      description="Trumpi paaiškinimai apie Formą A, Formą B, 14 stulpelių, vertybių hierarchiją ir kaip visa tai taikoma tavo augime."
    />
  ),
});
