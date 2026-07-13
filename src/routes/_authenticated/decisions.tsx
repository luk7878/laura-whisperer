import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Beaker,
  Brain,
  CheckCircle2,
  Clock3,
  Compass,
  FlaskConical,
  History,
  Loader2,
  Plus,
  RotateCcw,
  Scale,
  Sparkles,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import type { Json } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/decisions")({ component: DecisionsPage });

type OptionDraft = { id: string; title: string };
type Fit = { value: string; fit: "high" | "medium" | "low"; reason: string };
type OptionAnalysis = {
  id: string;
  value_fit?: Fit[];
  short_benefits?: string[];
  long_benefits?: string[];
  costs?: string[];
  idealization?: string | null;
  devaluation?: string | null;
  external_expectations?: string | null;
  related_goals?: string[];
  reversibility?: { level: "high" | "medium" | "low"; reason: string };
  unknowns?: string[];
};
type Analysis = {
  summary?: string;
  criteria?: string[];
  options?: OptionAnalysis[];
  tension?: string | null;
  experiment?: {
    title?: string;
    action?: string;
    duration_days?: number;
    success_signal?: string;
    review_question?: string;
  };
};
type SavedLab = {
  id: string;
  dilemma: string;
  options: Json;
  analysis: Json;
  status: string;
  created_at: string;
};

function DecisionsPage() {
  const [dilemma, setDilemma] = useState("");
  const [options, setOptions] = useState<OptionDraft[]>([
    { id: crypto.randomUUID(), title: "" },
    { id: crypto.randomUUID(), title: "" },
  ]);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [history, setHistory] = useState<SavedLab[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    void loadHistory();
  }, []);
  async function loadHistory() {
    const { data } = await supabase
      .from("decision_labs")
      .select("id,dilemma,options,analysis,status,created_at")
      .order("created_at", { ascending: false })
      .limit(20);
    setHistory((data as SavedLab[]) ?? []);
  }

  async function analyze() {
    const cleanOptions = options.filter((option) => option.title.trim());
    if (!dilemma.trim() || cleanOptions.length < 2)
      return toast.error("Įrašyk dilemą ir bent du variantus");
    setAnalyzing(true);
    try {
      const { data: auth } = await supabase.auth.getSession();
      const token = auth.session?.access_token;
      const userId = auth.session?.user.id;
      if (!token || !userId) throw new Error("Nesi prisijungęs");
      const response = await fetch("/api/decision-lab", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ dilemma, options: cleanOptions }),
      });
      if (!response.ok) throw new Error(await response.text());
      const body = (await response.json()) as { analysis: Analysis };
      setAnalysis(body.analysis);
      const { error } = await supabase.from("decision_labs").insert({
        user_id: userId,
        dilemma: dilemma.trim(),
        options: cleanOptions as unknown as Json,
        analysis: body.analysis as unknown as Json,
      });
      if (error) toast.info("Analizė paruošta. Istorijai išsaugoti pritaikyk naują migraciją.");
      else void loadHistory();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nepavyko išanalizuoti sprendimo");
    } finally {
      setAnalyzing(false);
    }
  }

  function openSaved(item: SavedLab) {
    const savedOptions = Array.isArray(item.options)
      ? (item.options as unknown as OptionDraft[])
      : [];
    setDilemma(item.dilemma);
    setOptions(savedOptions.length >= 2 ? savedOptions : options);
    setAnalysis(
      (item.analysis && typeof item.analysis === "object" ? item.analysis : {}) as Analysis,
    );
    setShowHistory(false);
  }
  function reset() {
    setDilemma("");
    setOptions([
      { id: crypto.randomUUID(), title: "" },
      { id: crypto.randomUUID(), title: "" },
    ]);
    setAnalysis(null);
  }
  function addOption() {
    if (options.length < 4)
      setOptions((current) => [...current, { id: crypto.randomUUID(), title: "" }]);
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <header className="app-page-header">
        <SidebarTrigger />
        <div className="min-w-0 flex-1">
          <h1 className="font-serif text-xl md:text-2xl">Sprendimų laboratorija</h1>
          <p className="hidden text-sm text-muted-foreground sm:block">
            Ne spėjimas, ką rinktis — aiškesnis abiejų kelių vaizdas.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowHistory((value) => !value)}
          className="gap-2"
        >
          <History className="h-4 w-4" /> <span className="hidden sm:inline">Istorija</span>
        </Button>
      </header>
      <div className="app-page-body">
        <div className="mx-auto max-w-6xl space-y-5">
          {showHistory ? (
            <HistoryView items={history} onOpen={openSaved} onBack={() => setShowHistory(false)} />
          ) : (
            <>
              <Card className="overflow-hidden border-primary/15 bg-gradient-to-br from-primary/[0.09] via-card to-map-violet/[0.06] p-5 md:p-7">
                <div className="flex items-start gap-4">
                  <div className="rounded-2xl bg-primary/10 p-3 text-primary">
                    <Scale className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                      Neutralus sprendimo vaizdas
                    </div>
                    <h2 className="mt-2 font-serif text-2xl md:text-3xl">
                      Palygink ne tik naudą, bet ir kiekvieno kelio kainą
                    </h2>
                    <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
                      Laboratorija remiasi tavo TOP vertybėmis, tikslais ir dabartiniais
                      prioritetais. Ji nepateiks verdikto — gausi matricą ir mažą eksperimentą,
                      kuris suteiks daugiau realių duomenų.
                    </p>
                  </div>
                </div>
              </Card>
              {!analysis ? (
                <DecisionForm
                  dilemma={dilemma}
                  setDilemma={setDilemma}
                  options={options}
                  setOptions={setOptions}
                  onAdd={addOption}
                  onAnalyze={analyze}
                  analyzing={analyzing}
                />
              ) : (
                <Results dilemma={dilemma} options={options} analysis={analysis} onReset={reset} />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function DecisionForm({
  dilemma,
  setDilemma,
  options,
  setOptions,
  onAdd,
  onAnalyze,
  analyzing,
}: {
  dilemma: string;
  setDilemma: (value: string) => void;
  options: OptionDraft[];
  setOptions: React.Dispatch<React.SetStateAction<OptionDraft[]>>;
  onAdd: () => void;
  onAnalyze: () => void;
  analyzing: boolean;
}) {
  return (
    <Card className="p-5 md:p-7">
      <div>
        <label className="text-sm font-semibold">Kokią dilemą sprendi?</label>
        <Textarea
          value={dilemma}
          onChange={(event) => setDilemma(event.target.value)}
          rows={3}
          className="mt-2 text-base"
          placeholder="Pvz. Likti dabartiniame darbe ar kurti savo veiklą?"
        />
      </div>
      <div className="mt-6 flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold">Realūs variantai</div>
          <p className="text-xs text-muted-foreground">Įrašyk 2–4 konkrečius kelius.</p>
        </div>
        {options.length < 4 && (
          <Button variant="ghost" size="sm" onClick={onAdd}>
            <Plus className="h-4 w-4" /> Pridėti
          </Button>
        )}
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        {options.map((option, index) => (
          <div
            key={option.id}
            className="flex items-center gap-2 rounded-xl border bg-muted/20 p-3"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 font-serif text-primary">
              {String.fromCharCode(65 + index)}
            </div>
            <Input
              value={option.title}
              onChange={(event) =>
                setOptions((current) =>
                  current.map((item) =>
                    item.id === option.id ? { ...item, title: event.target.value } : item,
                  ),
                )
              }
              placeholder="Aprašyk variantą…"
              className="border-0 bg-transparent shadow-none"
            />
            {options.length > 2 && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() =>
                  setOptions((current) => current.filter((item) => item.id !== option.id))
                }
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        ))}
      </div>
      <Button className="mt-6 w-full gap-2 sm:w-auto" onClick={onAnalyze} disabled={analyzing}>
        {analyzing ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <FlaskConical className="h-4 w-4" />
        )}{" "}
        {analyzing ? "Lyginami abu keliai…" : "Sukurti sprendimo matricą"}
      </Button>
    </Card>
  );
}

function Results({
  dilemma,
  options,
  analysis,
  onReset,
}: {
  dilemma: string;
  options: OptionDraft[];
  analysis: Analysis;
  onReset: () => void;
}) {
  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Badge variant="secondary">Dilema</Badge>
          <h2 className="mt-2 font-serif text-2xl">{dilemma}</h2>
          {analysis.summary && (
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">{analysis.summary}</p>
          )}
        </div>
        <Button variant="outline" onClick={onReset}>
          <RotateCcw className="h-4 w-4" /> Nauja dilema
        </Button>
      </div>
      {analysis.tension && (
        <Card className="border-violet-200 bg-violet-50/60 p-4 dark:border-violet-900 dark:bg-violet-950/20">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-map-violet">
            <Scale className="h-4 w-4" /> Vertybinė įtampa
          </div>
          <p className="mt-2 font-serif text-xl">{analysis.tension}</p>
        </Card>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        {options.map((option, index) => (
          <OptionCard
            key={option.id}
            letter={String.fromCharCode(65 + index)}
            title={option.title}
            data={analysis.options?.find((item) => item.id === option.id)}
          />
        ))}
      </div>
      {analysis.criteria?.length ? (
        <Card className="p-5">
          <div className="flex items-center gap-2 font-semibold">
            <Compass className="h-4 w-4 text-primary" /> Kriterijai, kuriuos verta pasverti
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {analysis.criteria.map((criterion) => (
              <Badge key={criterion} variant="secondary" className="px-3 py-1.5">
                {criterion}
              </Badge>
            ))}
          </div>
        </Card>
      ) : null}
      {analysis.experiment && (
        <Card className="overflow-hidden border-map-green/25 bg-gradient-to-br from-map-green/[0.08] to-card p-5 md:p-6">
          <div className="flex items-start gap-4">
            <div className="rounded-xl bg-map-green/15 p-3 text-map-green">
              <Beaker className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-map-green">
                Mažas grįžtamas eksperimentas
              </div>
              <h3 className="mt-2 font-serif text-2xl">{analysis.experiment.title}</h3>
              <p className="mt-2 text-sm font-medium">{analysis.experiment.action}</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <Info
                  label="Trukmė"
                  text={`${analysis.experiment.duration_days ?? 7} dienos`}
                  icon={Clock3}
                />
                <Info
                  label="Sėkmės signalas"
                  text={analysis.experiment.success_signal ?? "Stebėk realius rezultatus"}
                  icon={CheckCircle2}
                />
              </div>
              {analysis.experiment.review_question && (
                <p className="mt-4 border-l-2 border-map-green/30 pl-3 font-serif text-lg">
                  {analysis.experiment.review_question}
                </p>
              )}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

function OptionCard({
  letter,
  title,
  data,
}: {
  letter: string;
  title: string;
  data?: OptionAnalysis;
}) {
  return (
    <Card className="overflow-hidden">
      <div className="border-b bg-muted/20 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground font-serif">
            {letter}
          </div>
          <h3 className="font-serif text-xl">{title}</h3>
          {data?.reversibility && (
            <Badge variant="outline" className="ml-auto">
              Grįžtamumas: {levelLabel(data.reversibility.level)}
            </Badge>
          )}
        </div>
      </div>
      <div className="space-y-4 p-4">
        <MatrixSection title="Ryšys su TOP vertybėmis" icon={Sparkles}>
          {data?.value_fit?.map((fit) => (
            <div key={fit.value} className="rounded-lg border p-2.5">
              <div className="flex items-center gap-2 text-sm font-medium">
                {fit.value}
                <Badge variant="secondary" className="ml-auto text-[10px]">
                  {levelLabel(fit.fit)}
                </Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{fit.reason}</p>
            </div>
          ))}
        </MatrixSection>
        <ListSection title="Trumpalaikės naudos" items={data?.short_benefits} />
        <ListSection title="Ilgalaikės naudos" items={data?.long_benefits} />
        <ListSection title="Kaina ir kompromisai" items={data?.costs} />
        {data?.idealization && <Hypothesis label="Galima idealizacija" text={data.idealization} />}
        {data?.devaluation && <Hypothesis label="Kas galbūt nuvertinama" text={data.devaluation} />}
        {data?.external_expectations && (
          <Hypothesis label="Galimas svetimas lūkestis" text={data.external_expectations} />
        )}
        {data?.related_goals?.length ? (
          <ListSection title="Susiję tikslai" items={data.related_goals} />
        ) : null}
        {data?.reversibility && (
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Grįžtamumas:</strong> {data.reversibility.reason}
          </p>
        )}
        <ListSection title="Ką dar reikia patikrinti" items={data?.unknowns} />
      </div>
    </Card>
  );
}
function MatrixSection({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof Brain;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {title}
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}
function ListSection({ title, items }: { title: string; items?: string[] }) {
  if (!items?.length) return null;
  return (
    <div>
      <div className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </div>
      <ul className="space-y-1.5">
        {items.map((item) => (
          <li key={item} className="flex gap-2 text-sm">
            <span className="text-primary">•</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
function Hypothesis({ label, text }: { label: string; text: string }) {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 dark:border-amber-900 dark:bg-amber-950/20">
      <div className="text-xs font-semibold text-amber-700 dark:text-amber-300">{label}</div>
      <p className="mt-1 text-sm text-muted-foreground">{text}</p>
    </div>
  );
}
function Info({ label, text, icon: Icon }: { label: string; text: string; icon: typeof Brain }) {
  return (
    <div className="rounded-xl border bg-background/70 p-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className="mt-1 text-sm font-medium">{text}</div>
    </div>
  );
}
function HistoryView({
  items,
  onOpen,
  onBack,
}: {
  items: SavedLab[];
  onOpen: (item: SavedLab) => void;
  onBack: () => void;
}) {
  return (
    <div>
      <Button variant="ghost" onClick={onBack}>
        <ArrowLeft className="h-4 w-4" /> Grįžti
      </Button>
      <h2 className="mt-4 font-serif text-2xl">Ankstesnės dilemos</h2>
      <div className="mt-4 space-y-3">
        {items.length ? (
          items.map((item) => (
            <Card
              key={item.id}
              className="cursor-pointer p-4 transition hover:border-primary/30 hover:shadow-sm"
              onClick={() => onOpen(item)}
            >
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-primary/10 p-2 text-primary">
                  <Scale className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <div className="font-medium">{item.dilemma}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {new Date(item.created_at).toLocaleDateString("lt-LT")}
                  </div>
                </div>
                <Badge variant="outline">
                  {item.status === "active" ? "Analizuojama" : item.status}
                </Badge>
              </div>
            </Card>
          ))
        ) : (
          <Card className="border-dashed p-8 text-center text-sm text-muted-foreground">
            Išsaugotų dilemų dar nėra.
          </Card>
        )}
      </div>
    </div>
  );
}
function levelLabel(value: string) {
  if (value === "high") return "aukštas";
  if (value === "medium") return "vidutinis";
  return "žemas";
}
