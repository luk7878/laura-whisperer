import ReactMarkdown from "react-markdown";
import { HelpCircle, Info, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";

type Parsed = {
  intro: string;
  etapas?: string;
  fokusas?: string;
  klausimas?: string;
  hint?: string;
  intensity?: string;
};

function parseAnalysis(text: string): Parsed {
  const grabLine = (label: string) =>
    text.match(new RegExp(`\\*\\*${label}:\\*\\*\\s*([^\\n]+)`, "i"))?.[1]?.trim();
  const etapas = grabLine("Etapas");
  const fokusas = grabLine("Fokusas");
  const klausimas = text
    .match(/\*\*Klausimas:\*\*\s*([\s\S]*?)(?=\n\s*\*[^*]|\n\s*\*\*|$)/i)?.[1]
    ?.trim();

  // intensity: "**Pradinis emocinis intensyvumas: 8/10**" or "**Emocinis intensyvumas: 8/10**"
  const im = text.match(/\*\*(?:Pradinis\s+)?[Ee]mocinis intensyvumas:\s*(\d+\/\d+)\*\*/);
  const intensity = im?.[1];

  // hint: italic line at end starting with *Atsakyk / *Pabandyk / *Pagalvok
  const hintMatch = text.match(/\*([^*\n]{6,240})\*(?!\*)/g);
  const hint = hintMatch?.[hintMatch.length - 1]?.replace(/^\*|\*$/g, "").trim();

  // Reflection can be before the metadata or between Fokusas and Klausimas.
  const beforeEtapas = text.split(/\*\*Etapas:\*\*/i)[0]?.trim();
  const betweenFocusAndQuestion = text
    .match(/\*\*Fokusas:\*\*[^\n]*\n+([\s\S]*?)(?=\*\*Klausimas:\*\*)/i)?.[1]
    ?.trim();
  const intro = beforeEtapas || betweenFocusAndQuestion || "";

  return { intro, etapas, fokusas, klausimas, hint, intensity };
}

// Match a **Etapas:** value to one of 11 canonical steps
const STAGES = [
  ["tema", "situacij", "konkret"],
  ["emoc", "intensyv", "krūv"],
  ["problem", "formul", "sakin"],
  ["trūkum", "skausm", "kliūt"],
  ["nauda", "paslėpt"],
  ["priešing", "trūkum"],
  ["idealiz", "nuvertin"],
  ["vertyb"],
  ["balans", "integrav"],
  ["pakartotin", "grįžt"],
  ["veiksm", "žingsn", "pabaig"],
];

export function detectStage(etapas?: string): number | null {
  if (!etapas) return null;
  const s = etapas.toLowerCase();
  for (let i = STAGES.length - 1; i >= 0; i--) {
    if (STAGES[i].some((k) => s.includes(k))) return i + 1;
  }
  return null;
}

export function detectStageFromMessages(messages: { role: string; content: string }[]): number {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role !== "assistant") continue;
    const { etapas } = parseAnalysis(messages[i].content);
    const s = detectStage(etapas);
    if (s) return s;
  }
  return 1;
}

export function AnalysisCard({
  content,
  time,
  emotionValue,
}: {
  content: string;
  time?: string;
  emotionValue?: number | null;
}) {
  const p = parseAnalysis(content);
  const hasStructure = p.etapas || p.fokusas || p.klausimas;

  return (
    <div className="grid overflow-hidden rounded-3xl border border-border/70 bg-card shadow-sm lg:grid-cols-[1.45fr_0.9fr]">
      <section className="p-5 md:p-7">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-primary">
            <Sparkles className="h-4 w-4" />
            Dabartinė įžvalga
          </div>
          {time && <span className="text-xs text-muted-foreground">{time}</span>}
        </div>

        {hasStructure && (p.etapas || p.fokusas) && (
          <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm">
            {p.etapas && (
              <p>
                <span className="text-muted-foreground">Etapas: </span>
                <span className="font-medium">{p.etapas}</span>
              </p>
            )}
            {p.fokusas && (
              <p>
                <span className="text-muted-foreground">Fokusas: </span>
                <span className="font-medium">{p.fokusas}</span>
              </p>
            )}
          </div>
        )}

        {p.intro && (
          <div className="mt-6">
            <div className="prose prose-sm dark:prose-invert max-w-none leading-relaxed prose-headings:font-serif prose-headings:text-foreground prose-headings:leading-tight prose-headings:mb-3 prose-p:my-2.5 prose-strong:text-foreground md:prose-lg">
              <ReactMarkdown>{p.intro}</ReactMarkdown>
            </div>
          </div>
        )}

        {p.intensity && (
          <p className="mt-5 text-sm text-muted-foreground">
            Emocinis intensyvumas: <strong className="text-foreground">{p.intensity}</strong>
          </p>
        )}

        {p.hint && (
          <p className="mt-6 border-l-2 border-primary/35 pl-4 text-sm leading-relaxed text-muted-foreground">
            <span className="font-semibold text-foreground">Esmė: </span>
            {p.hint}
          </p>
        )}

        {!hasStructure && !p.intro && (
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown>{content || "…"}</ReactMarkdown>
          </div>
        )}
      </section>

      {p.klausimas && (
        <aside className="relative min-h-[260px] border-t border-map-green/15 bg-map-green/[0.045] p-5 md:p-7 lg:border-l lg:border-t-0">
          <div className="relative flex items-center gap-2.5 text-map-green">
            <HelpCircle className="h-4 w-4" />
            <span className="text-sm font-semibold">Dabar atsakyk</span>
          </div>
          <p className="relative mt-8 whitespace-pre-wrap font-serif text-xl font-medium leading-8 text-foreground md:text-2xl">
            {p.klausimas}
          </p>
          {(emotionValue != null || /0\s*[–—-]\s*10|emocin/i.test(p.klausimas)) && (
            <div className="relative mt-8">
              <div className="mb-2 flex justify-between px-0.5 text-[10px] text-muted-foreground">
                {Array.from({ length: 11 }, (_, value) => (
                  <span
                    key={value}
                    className={value === emotionValue ? "font-semibold text-map-green" : ""}
                  >
                    {value}
                  </span>
                ))}
              </div>
              <div className="relative flex items-center justify-between">
                <div className="absolute inset-x-2 top-1/2 h-px -translate-y-1/2 bg-border" />
                {Array.from({ length: 11 }, (_, value) => (
                  <span
                    key={value}
                    className={`relative z-10 h-4 w-4 rounded-full border-2 bg-background ${
                      value === emotionValue
                        ? "scale-125 border-map-green bg-map-green shadow-[0_0_0_6px_color-mix(in_oklab,var(--color-map-green)_18%,transparent)]"
                        : "border-border"
                    }`}
                  />
                ))}
              </div>
            </div>
          )}
        </aside>
      )}
    </div>
  );
}

export function UserCard({ content, time }: { content: string; time?: string }) {
  return (
    <Card className="border-primary/10 bg-primary/[0.03] overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-primary/10">
        <div className="flex items-center gap-2 text-primary font-medium text-sm">
          <Info className="h-4 w-4" /> Kliento atsakymas
        </div>
        {time && <span className="text-xs text-muted-foreground">{time}</span>}
      </div>
      <div className="px-5 py-4 text-sm whitespace-pre-wrap text-right text-foreground">
        {content}
      </div>
    </Card>
  );
}
