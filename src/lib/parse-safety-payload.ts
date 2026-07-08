// Ištraukia AI paslėptą saugiklio JSON: ---SAFETY---\n{"need_human":true,...}
export type SafetyPayload = { need_human?: boolean; reason?: string };

const MARKER = /\n?-{3,}\s*SAFETY\s*-{3,}\s*\n([\s\S]*?)$/i;

export function extractSafetyPayload(text: string): { clean: string; payload: SafetyPayload | null } {
  const m = text.match(MARKER);
  if (!m) return { clean: text, payload: null };
  const clean = text.slice(0, m.index).trimEnd();
  try {
    const raw = m[1].replace(/```json|```/gi, "").trim();
    return { clean, payload: JSON.parse(raw) as SafetyPayload };
  } catch {
    return { clean, payload: null };
  }
}
