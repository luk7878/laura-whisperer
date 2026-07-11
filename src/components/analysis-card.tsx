import ReactMarkdown from "react-markdown";
import { Flag, Target, HelpCircle, Info, Lightbulb, Activity, Sparkles } from "lucide-react";
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

export function AnalysisCard({ content, time }: { content: string; time?: string }) {
  const p = parseAnalysis(content);
  const hasStructure = p.etapas || p.fokusas || p.klausimas;

  return (
    <Card className="overflow-hidden rounded-2xl border-primary/10 bg-card shadow-sm">
      <div className="flex items-center justify-between px-5 py-4 md:px-6">
        <div className="flex items-center gap-2.5 font-semibold text-foreground">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Sparkles className="h-4 w-4" />
          </div>
          AI analizė
        </div>
        {time && <span className="text-xs text-muted-foreground">{time}</span>}
      </div>

      <div className="grid gap-4 px-4 pb-4 md:px-6 md:pb-6 lg:grid-cols-[1.75fr_0.85fr]">
        <div className="rounded-2xl border bg-background p-4 shadow-sm md:p-5">
          {hasStructure && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                icon={<Flag className="h-4 w-4" />}
                label="Etapas"
                value={p.etapas}
                tone="primary"
              />
              <Field
                icon={<Target className="h-4 w-4" />}
                label="Fokusas"
                value={p.fokusas}
                tone="violet"
              />
            </div>
          )}

          {p.intro && (
            <div className="mt-5">
              <div className="prose prose-sm dark:prose-invert max-w-none leading-relaxed prose-headings:font-serif prose-headings:text-foreground prose-headings:leading-tight prose-headings:mb-3 prose-p:my-2.5 prose-strong:text-foreground md:prose-lg">
                <ReactMarkdown>{p.intro}</ReactMarkdown>
              </div>
              <div className="mt-4 h-0.5 w-24 bg-gradient-to-r from-primary via-map-violet to-transparent" />
            </div>
          )}

          {p.intensity && (
            <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1.5 text-xs">
              <Activity className="h-3.5 w-3.5 text-primary" />
              <span className="text-muted-foreground">Emocinis intensyvumas</span>
              <span className="font-semibold text-primary">{p.intensity}</span>
            </div>
          )}

          {p.hint && (
            <div className="mt-5 flex items-start gap-3 rounded-xl border border-map-violet/15 bg-gradient-to-r from-map-violet/10 to-primary/5 px-4 py-3 text-sm">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-map-violet/15 text-map-violet">
                <Lightbulb className="h-4 w-4" />
              </div>
              <div className="leading-relaxed text-map-violet">
                <span className="font-semibold">Esmė: </span>
                {p.hint}
              </div>
            </div>
          )}

          {!hasStructure && !p.intro && (
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown>{content || "…"}</ReactMarkdown>
            </div>
          )}
        </div>

        {p.klausimas && (
          <div className="relative min-h-[260px] overflow-hidden rounded-2xl border border-map-green/20 bg-gradient-to-br from-map-green/[0.06] via-background to-map-teal/[0.10] p-5 shadow-sm md:p-6">
            <div className="absolute -bottom-20 -right-20 h-56 w-56 rounded-full bg-map-green/[0.07]" />
            <div className="absolute -right-8 top-8 h-20 w-20 rounded-full bg-map-teal/[0.05]" />
            <div className="relative flex items-center gap-2.5 text-map-green">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-map-green/15">
                <HelpCircle className="h-5 w-5" />
              </div>
              <span className="font-semibold">Klausimas</span>
            </div>
            <div className="relative mt-7 text-5xl font-serif leading-none text-map-green/30">
              “
            </div>
            <p className="relative -mt-2 whitespace-pre-wrap text-base font-medium leading-8 text-foreground md:text-lg">
              {p.klausimas}
            </p>
            <div className="relative mt-3 text-right text-5xl font-serif leading-none text-map-green/30">
              ”
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

function Field({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string;
  tone: "primary" | "violet" | "teal";
}) {
  const toneMap = {
    primary: "text-primary bg-primary/10",
    violet: "text-map-violet bg-map-violet/10",
    teal: "text-teal-600 bg-teal-500/10",
  };
  return (
    <div className="flex min-h-[92px] gap-3 rounded-xl border bg-card/80 p-3.5">
      <div
        className={`h-9 w-9 rounded-full flex items-center justify-center shrink-0 ${toneMap[tone]}`}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <div className={`text-sm font-medium ${toneMap[tone].split(" ")[0]}`}>{label}</div>
        <div className="text-sm text-foreground/90 leading-snug mt-0.5 whitespace-pre-wrap">
          {value || <span className="text-muted-foreground">—</span>}
        </div>
      </div>
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
