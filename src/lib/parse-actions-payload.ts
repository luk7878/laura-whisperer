export type ActionSuggestion = {
  kind: "goal" | "priority" | "task";
  title: string;
  description?: string;
  due_in_days?: number;
};

const MARKER = /\n?-{3,}\s*ACTIONS\s*-{3,}\s*\n([\s\S]*?)$/i;

export function extractActionsPayload(text: string): {
  clean: string;
  actions: ActionSuggestion[];
} {
  const m = text.match(MARKER);
  if (!m) return { clean: text, actions: [] };
  const clean = text.slice(0, m.index).trimEnd();
  try {
    const raw = m[1].replace(/```json|```/gi, "").trim();
    const parsed = JSON.parse(raw);
    const list = Array.isArray(parsed?.suggestions) ? parsed.suggestions : [];
    const actions: ActionSuggestion[] = list
      .filter((x: unknown): x is Record<string, unknown> => !!x && typeof x === "object")
      .map((x) => ({
        kind: (x.kind === "goal" || x.kind === "priority" || x.kind === "task"
          ? x.kind
          : "priority") as ActionSuggestion["kind"],
        title: String(x.title ?? "").slice(0, 160),
        description: x.description ? String(x.description).slice(0, 400) : undefined,
        due_in_days: typeof x.due_in_days === "number" ? x.due_in_days : undefined,
      }))
      .filter((x: ActionSuggestion) => x.title.trim().length > 0)
      .slice(0, 3);
    return { clean, actions };
  } catch {
    return { clean, actions: [] };
  }
}
