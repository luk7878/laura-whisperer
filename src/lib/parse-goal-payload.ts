export type GoalPayload = {
  stage?: string;
  goal_draft?: string;
  why?: string;
  value?: string;
  benefits?: string;
  costs?: string;
  obstacles?: string;
  first_step?: string;
  ready_to_save?: boolean;
  patterns?: string[];
};

const MARKER = /\n?-{3,}\s*GOAL\s*-{3,}\s*\n([\s\S]*?)$/i;

export function extractGoalPayload(text: string): { clean: string; payload: GoalPayload | null } {
  const m = text.match(MARKER);
  if (!m) return { clean: text, payload: null };
  const clean = text.slice(0, m.index).trimEnd();
  try {
    const raw = m[1].replace(/```json|```/gi, "").trim();
    const payload = JSON.parse(raw) as GoalPayload;
    return { clean, payload };
  } catch {
    return { clean, payload: null };
  }
}
