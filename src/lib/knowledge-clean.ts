/**
 * Text cleaning for knowledge base ingestion.
 * Removes greetings, filler lines, timestamps, page numbers, and collapses whitespace.
 * Also provides a lightweight language detector (LT vs other).
 */

// Lines matching any of these (case-insensitive, whole line after trim) are dropped.
const DROP_LINE_PATTERNS: RegExp[] = [
  // greetings / goodbyes (LT + EN)
  /^(sveiki|labas|labas rytas|labas vakaras|hello|hi|hey)[.,!\s]*$/i,
  /^(ačiū|aciu|thanks|thank you|iki|iki pasimatymo|bye|goodbye|see you)[.,!\s]*$/i,
  /^(gerai|okay|ok|so)[.,!\s]*$/i,
  // pure timestamps like [00:12:34] or 00:12
  /^\[?\d{1,2}:\d{2}(:\d{2})?\]?$/,
  // page markers
  /^(page|psl\.?|puslapis)\s*\d+(\s*\/\s*\d+)?$/i,
  /^\d+\s*\/\s*\d+$/,
  // lone page numbers
  /^\d{1,4}$/,
  // hosts announcing themselves
  /^(host|moderator|vedėjas|vedejas)\s*[:\-]/i,
];

// Inline substrings that should be scrubbed out of a line (case-insensitive, global).
const INLINE_STRIP: RegExp[] = [
  // timestamps mid-line
  /\[\d{1,2}:\d{2}(:\d{2})?\]/g,
  /\(\d{1,2}:\d{2}(:\d{2})?\)/g,
  // page footers "Page 12 of 200"
  /\bpage\s+\d+\s+of\s+\d+\b/gi,
];

// Whole sentences (ending with . ! ? or newline) matching these get removed.
const DROP_SENTENCE_PATTERNS: RegExp[] = [
  /so,?\s*for those who (remember|don't know|do not know)[^.!?\n]*[.!?]/gi,
  /okay,?\s*so now (we|i) will[^.!?\n]*[.!?]/gi,
  /as (i|we) (mentioned|said) (earlier|before)[^.!?\n]*[.!?]/gi,
  /kaip jau minėjau[^.!?\n]*[.!?]/gi,
  /kaip jau sakiau[^.!?\n]*[.!?]/gi,
];

export function cleanKnowledgeText(input: string): string {
  if (!input) return "";
  let text = input.replace(/\r\n/g, "\n");

  // remove drop sentences first (multi-line safe on single line basis)
  for (const re of DROP_SENTENCE_PATTERNS) text = text.replace(re, " ");

  // per-line cleanup
  const lines = text.split("\n").map((raw) => {
    let line = raw;
    for (const re of INLINE_STRIP) line = line.replace(re, " ");
    line = line.replace(/[ \t]+/g, " ").trim();
    if (!line) return "";
    for (const re of DROP_LINE_PATTERNS) if (re.test(line)) return "";
    return line;
  });

  // collapse 3+ blank lines to 2, join
  const out: string[] = [];
  let blanks = 0;
  for (const l of lines) {
    if (!l) {
      blanks++;
      if (blanks <= 1) out.push("");
    } else {
      blanks = 0;
      out.push(l);
    }
  }
  return out.join("\n").trim();
}

/** Chunk-level quality guard. Returns true if chunk should be indexed. */
export function isChunkUseful(chunk: string): boolean {
  const trimmed = chunk.trim();
  if (trimmed.length < 80) return false;
  const letters = trimmed.match(/\p{L}/gu)?.length ?? 0;
  if (letters / trimmed.length < 0.4) return false;
  return true;
}

const LT_CHARS = /[ąčęėįšųūž]/gi;

/** Very rough language guess: "lt" if ≥ 0.5% of chars are LT-specific, else "en" for latin, else "other". */
export function detectLanguage(text: string): "lt" | "en" | "other" {
  const sample = text.slice(0, 5000);
  const total = sample.replace(/\s/g, "").length;
  if (total < 40) return "other";
  const lt = sample.match(LT_CHARS)?.length ?? 0;
  if (lt / total >= 0.005) return "lt";
  const latin = sample.match(/[a-zA-Z]/g)?.length ?? 0;
  if (latin / total > 0.5) return "en";
  return "other";
}
