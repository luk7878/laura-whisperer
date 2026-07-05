import { AI_GATEWAY_URL, requireLovableApiKey } from "@/lib/ai-gateway.server";

const EMBEDDING_MODEL = "openai/text-embedding-3-small";
export const EMBEDDING_DIMS = 1536;

/** Split text into ~800-char chunks with ~150-char overlap on paragraph/sentence boundaries. */
export function chunkText(text: string, target = 800, overlap = 150): string[] {
  const clean = text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (!clean) return [];
  const paragraphs = clean.split(/\n\n+/);
  const chunks: string[] = [];
  let buf = "";
  for (const p of paragraphs) {
    if ((buf + "\n\n" + p).length <= target) {
      buf = buf ? buf + "\n\n" + p : p;
    } else {
      if (buf) chunks.push(buf);
      if (p.length <= target) {
        buf = p;
      } else {
        // split long paragraph by sentences
        const sentences = p.split(/(?<=[.!?…])\s+/);
        let s = "";
        for (const sent of sentences) {
          if ((s + " " + sent).length <= target) {
            s = s ? s + " " + sent : sent;
          } else {
            if (s) chunks.push(s);
            if (sent.length > target) {
              // hard-split extremely long "sentence"
              for (let i = 0; i < sent.length; i += target) {
                chunks.push(sent.slice(i, i + target));
              }
              s = "";
            } else {
              s = sent;
            }
          }
        }
        if (s) buf = s;
        else buf = "";
      }
    }
  }
  if (buf) chunks.push(buf);

  // add overlap
  if (overlap > 0 && chunks.length > 1) {
    for (let i = 1; i < chunks.length; i++) {
      const prev = chunks[i - 1];
      const tail = prev.slice(Math.max(0, prev.length - overlap));
      chunks[i] = tail + "\n\n" + chunks[i];
    }
  }
  return chunks;
}

export async function embedTexts(inputs: string[]): Promise<number[][]> {
  if (inputs.length === 0) return [];
  const key = requireLovableApiKey();
  // OpenAI text-embedding-3-small supports batches; keep well under 300k token cap
  const BATCH = 64;
  const out: number[][] = [];
  for (let i = 0; i < inputs.length; i += BATCH) {
    const batch = inputs.slice(i, i + BATCH);
    const resp = await fetch(`${AI_GATEWAY_URL}/embeddings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({ model: EMBEDDING_MODEL, input: batch }),
    });
    if (!resp.ok) {
      const t = await resp.text().catch(() => "");
      throw new Error(`Embeddings failed [${resp.status}]: ${t}`);
    }
    const json = (await resp.json()) as { data: { index: number; embedding: number[] }[] };
    const sorted = [...json.data].sort((a, b) => a.index - b.index);
    for (const d of sorted) out.push(d.embedding);
  }
  return out;
}

export async function embedQuery(input: string): Promise<number[]> {
  const [v] = await embedTexts([input]);
  return v;
}
