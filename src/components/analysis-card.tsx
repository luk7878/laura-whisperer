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
  const grab = (label: string) => {
    const re = new RegExp(`\\*\\*${label}:\\*\\*\\s*([^\\n]*(?:\\n(?!\\*\\*|\\*[^*])[^\\n]*)*)`, "i");
    const m = text.match(re);
    return m?.[1]?.trim();
  };
  const etapas = grab("Etapas");
  const fokusas = grab("Fokusas");
  const klausimas = grab("Klausimas");

  // intensity: "**Pradinis emocinis intensyvumas: 8/10**" or "**Emocinis intensyvumas: 8/10**"
  const im = text.match(/\*\*(?:Pradinis\s+)?[Ee]mocinis intensyvumas:\s*(\d+\/\d+)\*\*/);
  const intensity = im?.[1];

  // hint: italic line at end starting with *Atsakyk / *Pabandyk / *Pagalvok
  const hintMatch = text.match(/\*([^*\n]{6,240})\*(?!\*)/g);
  const hint = hintMatch?.[hintMatch.length - 1]?.replace(/^\*|\*$/g, "").trim();

  // intro = everything before **Etapas:**
  const idx = text.search(/\*\*Etapas:\*\*/i);
  const intro = (idx >= 0 ? text.slice(0, idx) : text).trim();

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
    <Card className="border-primary/20 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b bg-primary/5">
        <div className="flex items-center gap-2 text-primary font-medium text-sm">
          <Sparkles className="h-4 w-4" /> AI analizė
        </div>
        {time && <span className="text-xs text-muted-foreground">{time}</span>}
      </div>

      <div className="p-5 space-y-4">
        {p.intro && (
          <div className="flex gap-4">
            <div className="prose prose-sm dark:prose-invert max-w-none flex-1 leading-relaxed">
              <ReactMarkdown>{p.intro}</ReactMarkdown>
            </div>
            {p.intensity && (
              <div className="flex flex-col items-center justify-center rounded-lg bg-primary/10 border border-primary/20 px-4 py-3 min-w-[130px]">
                <Activity className="h-5 w-5 text-primary mb-1" />
                <div className="text-xs text-muted-foreground">Emocinis intensyvumas</div>
                <div className="text-2xl font-semibold text-primary leading-tight">{p.intensity}</div>
              </div>
            )}
          </div>
        )}

        {hasStructure && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 rounded-lg border bg-muted/30 p-4">
            <Field icon={<Flag className="h-4 w-4" />} label="Etapas" value={p.etapas} tone="primary" />
            <Field icon={<Target className="h-4 w-4" />} label="Fokusas" value={p.fokusas} tone="violet" />
            <Field icon={<HelpCircle className="h-4 w-4" />} label="Klausimas" value={p.klausimas} tone="teal" />
          </div>
        )}

        {p.hint && (
          <div className="flex items-start gap-2 text-sm text-muted-foreground bg-muted/40 rounded-md px-3 py-2">
            <Lightbulb className="h-4 w-4 mt-0.5 shrink-0 text-amber-500" />
            <span className="italic">{p.hint}</span>
          </div>
        )}

        {!hasStructure && !p.intro && (
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown>{content || "…"}</ReactMarkdown>
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
    violet: "text-violet-600 bg-violet-500/10",
    teal: "text-teal-600 bg-teal-500/10",
  };
  return (
    <div className="flex gap-2">
      <div className={`h-8 w-8 rounded-md flex items-center justify-center shrink-0 ${toneMap[tone]}`}>
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
      <div className="px-5 py-4 text-sm whitespace-pre-wrap text-right text-foreground">{content}</div>
    </Card>
  );
}
