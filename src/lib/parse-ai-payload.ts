// AI atsakymo pabaigoje gali būti paslėptas Augimo žemėlapio JSON blokas:
//   ---MAP---
//   {"topic":"...","belief":"...","emotion":8,"column":"Paslėptos naudos","patterns":["baimė","palyginimas"],"grid":{"Situacija":"..."}}
// Šis modulis jį parsina ir grąžina švarų tekstą + payload.

export type MapPayload = {
  topic?: string;
  belief?: string;
  emotion?: number;
  column?: string;
  patterns?: string[];
  grid?: Record<string, string>;
  touched_value?: string;
  value_conflict?: { left: string; right: string } | null;
  value_dynamic?: "idealizacija" | "svetima_hierarchija" | "konfliktas" | "neaisku";
  value_dynamic_evidence?: string;
};

const MARKER = /\n?-{3,}\s*MAP\s*-{3,}\s*\n([\s\S]*?)$/i;

export function extractMapPayload(text: string): { clean: string; payload: MapPayload | null } {
  const m = text.match(MARKER);
  if (!m) return { clean: text, payload: null };
  const clean = text.slice(0, m.index).trimEnd();
  try {
    // Try direct JSON parse; also allow a fenced ```json ... ``` block after marker
    const raw = m[1].replace(/```json|```/gi, "").trim();
    const payload = JSON.parse(raw) as MapPayload;
    return { clean, payload };
  } catch {
    return { clean, payload: null };
  }
}
