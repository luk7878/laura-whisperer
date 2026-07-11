import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Compass,
  Edit3,
  Loader2,
  RefreshCw,
  Save,
  Sparkles,
  Trophy,
} from "lucide-react";
import { toast } from "sonner";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import type { Json } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/values")({ component: ValuesPage });

type Answer = {
  question: number;
  position: number;
  evidence: string;
  value: string;
};

type RankedValue = { name: string; count: number; rank: number; evidence: string[] };
type AssessmentRow = {
  id: string;
  status: string;
  current_step: number;
  answers: Json;
  result: Json;
  updated_at: string;
};

const QUESTIONS = [
  {
    title: "Kuo užpildai savo erdvę?",
    prompt:
      "Pažvelk į namus, darbo vietą, stalą ar daiktus, kuriuos visada nešiojiesi. Kokie 3 konkretūs dalykai ten svarbiausi?",
    hint: "Ne „daiktai“, o konkrečiai: užrašų knyga idėjoms, šeimos nuotraukos, sporto inventorius…",
  },
  {
    title: "Kam iš tikrųjų skiri laiką?",
    prompt:
      "Peržvelk paskutinį mėnesį. Kokios 3 konkrečios veiklos, neskaitant būtino miego, nuolat gauna daugiausia tavo laiko?",
    hint: "Ne „darbas“, o ką tiksliai darai darbe ir kokio rezultato tuo sieki.",
  },
  {
    title: "Kam visada randi energijos?",
    prompt:
      "Net po sunkios dienos kokiems 3 dalykams vis tiek atsiranda jėgų arba nuo ko tavo energija natūraliai grįžta?",
    hint: "Rinkis tai, kas matoma tavo elgesyje, o ne tai, ką norėtum daryti dažniau.",
  },
  {
    title: "Kur savo noru skiri pinigus?",
    prompt:
      "Atmetus mokesčius ir neišvengiamas išlaidas, kam dažniausiai ir noriausiai skiri pinigus? Įvardyk 3 kryptis.",
    hint: "Tai gali būti mokymai, šeimos patirtys, verslo priemonės, sveikata, kelionės ar kita.",
  },
  {
    title: "Kur esi natūraliai organizuotas?",
    prompt:
      "Kokiose 3 srityse tvarka atsiranda beveik savaime: planuoji, seki detales, kaupi informaciją ar viską randi laiku?",
    hint: "Organizuotumas vienoje srityje ir chaosas kitoje dažnai labai aiškiai parodo prioritetą.",
  },
  {
    title: "Kur esi patikimiausias ir disciplinuočiausias?",
    prompt:
      "Kokius 3 dalykus darai nuosekliai be išorinio spaudimo ir kur kiti gali tavimi pasikliauti?",
    hint: "Ieškok veiksmų, kuriems nereikia nuolatinės motyvacijos ar priminimų.",
  },
  {
    title: "Apie ką dažniausiai galvoji?",
    prompt:
      "Kokios 3 temos dažniausiai grįžta ryte, prieš miegą ar laisvą minutę? Skaičiuok realias paskutinio mėnesio mintis.",
    hint: "Atskirk tai, ko trokšti, nuo trumpalaikio nerimo. Klausk: kokį rezultatą nuolat bandau sukurti?",
  },
  {
    title: "Apie ką natūraliai kalbi?",
    prompt:
      "Kokios 3 temos įtraukia taip, kad gali ilgai kalbėti, dalintis ir klausinėti net be pasiruošimo?",
    hint: "Prisimink pokalbius su draugais, kolegomis ar šeima, kuriuose atgyji.",
  },
  {
    title: "Kokiose srityse keli ir įgyvendini tikslus?",
    prompt:
      "Kuriose 3 srityse tavo tikslai ne tik užrašyti, bet jau turi realių pasiektų rezultatų ar nuoseklių veiksmų?",
    hint: "Vertink įrodymus: ką jau užbaigei, sukūrei, pakeitei ar tęsi ilgą laiką.",
  },
  {
    title: "Ką labiausiai studijuoji?",
    prompt:
      "Kokias 3 temas dažniausiai renkiesi knygose, kursuose, vaizdo įrašuose, podkastuose ar straipsniuose?",
    hint: "Įtrauk ir turinį, kurį vartoji pramogai — jis taip pat atskleidžia pasikartojančias temas.",
  },
] as const;

const EMPTY_ANSWERS: Answer[] = QUESTIONS.flatMap((_, question) =>
  [0, 1, 2].map((position) => ({ question, position, evidence: "", value: "" })),
);

const LOCAL_DRAFT_KEY = "augimo-kompasas-values-draft";

function normalize(value: string) {
  return value.trim().toLocaleLowerCase("lt-LT").replace(/\s+/g, " ");
}

function calculateResults(answers: Answer[]): RankedValue[] {
  const groups = new Map<string, { name: string; evidence: string[]; count: number }>();
  for (const answer of answers) {
    const key = normalize(answer.value);
    if (!key || !answer.evidence.trim()) continue;
    const current = groups.get(key) ?? { name: answer.value.trim(), evidence: [], count: 0 };
    current.count += 1;
    current.evidence.push(answer.evidence.trim());
    groups.set(key, current);
  }
  return [...groups.values()]
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "lt"))
    .map((item, index) => ({ ...item, rank: index + 1 }));
}

function ValuesPage() {
  const [view, setView] = useState<"intro" | "exercise" | "results">("intro");
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>(EMPTY_ANSWERS);
  const [assessmentId, setAssessmentId] = useState<string | null>(null);
  const [lastAssessment, setLastAssessment] = useState<AssessmentRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [ranked, setRanked] = useState<RankedValue[]>([]);

  useEffect(() => {
    supabase
      .from("value_assessments")
      .select("id,status,current_step,answers,result,updated_at")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data, error }) => {
        let row = data as AssessmentRow | null;
        if (error) row = readLocalDraft();
        setLastAssessment(row);
        if (row && Array.isArray(row.answers)) {
          setAssessmentId(row.id);
          setStep(Math.min(row.current_step, QUESTIONS.length - 1));
          setAnswers(mergeAnswers(row.answers as unknown as Answer[]));
        }
        if (row?.status === "completed" && Array.isArray(row.result)) {
          setRanked(row.result as unknown as RankedValue[]);
        }
        setLoading(false);
      });
  }, []);

  const stepAnswers = answers.filter((answer) => answer.question === step);
  const completeOnStep = stepAnswers.every(
    (answer) => answer.evidence.trim().length >= 3 && answer.value.trim().length >= 2,
  );
  const completion = Math.round(
    (answers.filter((answer) => answer.evidence.trim() && answer.value.trim()).length /
      EMPTY_ANSWERS.length) *
      100,
  );
  const draftResults = useMemo(() => calculateResults(answers), [answers]);

  function updateAnswer(position: number, field: "evidence" | "value", value: string) {
    setAnswers((current) =>
      current.map((answer) =>
        answer.question === step && answer.position === position
          ? { ...answer, [field]: value }
          : answer,
      ),
    );
  }

  async function saveDraft(nextStep = step) {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) throw new Error("Nesi prisijungęs");
    const payload = {
      user_id: auth.user.id,
      status: "draft",
      current_step: nextStep,
      answers: answers as unknown as Json,
      updated_at: new Date().toISOString(),
    };
    if (assessmentId) {
      const { error } = await supabase
        .from("value_assessments")
        .update(payload)
        .eq("id", assessmentId);
      if (error) {
        writeLocalDraft({
          id: "local",
          status: "draft",
          current_step: nextStep,
          answers: answers as unknown as Json,
          result: [],
          updated_at: new Date().toISOString(),
        });
        if (assessmentId !== "local") throw error;
      }
      return assessmentId;
    }
    const { data, error } = await supabase
      .from("value_assessments")
      .insert(payload)
      .select("id")
      .single();
    if (error) {
      const local = {
        id: "local",
        status: "draft",
        current_step: nextStep,
        answers: answers as unknown as Json,
        result: [] as unknown as Json,
        updated_at: new Date().toISOString(),
      };
      writeLocalDraft(local);
      setAssessmentId("local");
      return "local";
    }
    setAssessmentId(data.id);
    return data.id;
  }

  async function next() {
    if (!completeOnStep) return toast.error("Užpildyk visus 3 atsakymus ir jų vertybes");
    setSaving(true);
    try {
      const nextStep = Math.min(step + 1, QUESTIONS.length - 1);
      await saveDraft(nextStep);
      if (step === QUESTIONS.length - 1) {
        setRanked(draftResults);
        setView("results");
      } else {
        setStep(nextStep);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nepavyko išsaugoti");
    } finally {
      setSaving(false);
    }
  }

  function renameGroup(index: number, name: string) {
    const old = ranked[index]?.name;
    setRanked((current) => current.map((item, i) => (i === index ? { ...item, name } : item)));
    if (!old) return;
    setAnswers((current) =>
      current.map((answer) =>
        normalize(answer.value) === normalize(old) ? { ...answer, value: name } : answer,
      ),
    );
  }

  function moveGroup(index: number, direction: -1 | 1) {
    setRanked((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next.map((item, rank) => ({ ...item, rank: rank + 1 }));
    });
  }

  async function finish() {
    const final = ranked
      .filter((value) => value.name.trim())
      .map((value, index) => ({ ...value, name: value.name.trim(), rank: index + 1 }));
    if (final.length < 2) return toast.error("Sukurk bent 2 aiškias vertybių grupes");
    if (new Set(final.map((value) => normalize(value.name))).size !== final.length) {
      return toast.error("Sujunk vienodai pavadintas vertybes į vieną grupę");
    }
    setSaving(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Nesi prisijungęs");
      const id = assessmentId ?? (await saveDraft(step));
      const { error: assessmentError } = await supabase
        .from("value_assessments")
        .update({
          status: "completed",
          current_step: 10,
          answers: answers as unknown as Json,
          result: final as unknown as Json,
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (assessmentError && id !== "local") throw assessmentError;

      const { data: existing, error: valuesError } = await supabase
        .from("values")
        .select("id,name,rank");
      if (valuesError) throw valuesError;
      const existingByName = new Map((existing ?? []).map((item) => [normalize(item.name), item]));
      const finalNames = new Set(final.map((value) => normalize(value.name)));
      for (const previous of existing ?? []) {
        if (!finalNames.has(normalize(previous.name))) {
          const { error } = await supabase
            .from("values")
            .update({ rank: 100 + (previous.rank ?? 0) })
            .eq("id", previous.id);
          if (error) throw error;
        }
      }
      for (const value of final) {
        const match = existingByName.get(normalize(value.name));
        if (match) {
          const { error } = await supabase
            .from("values")
            .update({ name: value.name, rank: value.rank })
            .eq("id", match.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from("values").insert({
            user_id: auth.user.id,
            name: value.name,
            rank: value.rank,
          });
          if (error) throw error;
        }
      }
      setRanked(final);
      setLastAssessment({
        id,
        status: "completed",
        current_step: 10,
        answers: answers as unknown as Json,
        result: final as unknown as Json,
        updated_at: new Date().toISOString(),
      });
      localStorage.removeItem(LOCAL_DRAFT_KEY);
      toast.success("Tavo vertybių hierarchija išsaugota");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nepavyko išsaugoti rezultatų");
    } finally {
      setSaving(false);
    }
  }

  function startFresh() {
    setAssessmentId(null);
    setAnswers(EMPTY_ANSWERS);
    setRanked([]);
    setStep(0);
    setView("exercise");
  }

  if (loading) {
    return (
      <div className="grid flex-1 place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <header className="app-page-header">
        <SidebarTrigger className="shrink-0" />
        <div className="min-w-0 flex-1">
          <h1 className="font-serif text-xl leading-tight md:text-2xl">Mano vertybės</h1>
          <p className="hidden truncate text-sm text-muted-foreground sm:block">
            Atrask ne norimas, o savo elgesiu kasdien demonstruojamas vertybes.
          </p>
        </div>
        {view !== "intro" && (
          <Button variant="outline" size="sm" onClick={() => setView("intro")}>
            <ArrowLeft /> Apžvalga
          </Button>
        )}
      </header>

      <div className="app-page-body">
        {view === "intro" && (
          <Intro
            assessment={lastAssessment}
            ranked={ranked}
            onStart={
              lastAssessment?.status === "completed" ? startFresh : () => setView("exercise")
            }
            onFresh={startFresh}
            onResults={() => setView("results")}
          />
        )}
        {view === "exercise" && (
          <Exercise
            step={step}
            answers={stepAnswers}
            completion={completion}
            complete={completeOnStep}
            saving={saving}
            onAnswer={updateAnswer}
            onBack={() => setStep((current) => Math.max(0, current - 1))}
            onNext={next}
          />
        )}
        {view === "results" && (
          <Results
            ranked={ranked.length ? ranked : draftResults}
            saving={saving}
            completed={lastAssessment?.status === "completed"}
            onRename={renameGroup}
            onMove={moveGroup}
            onFinish={finish}
            onBack={() => {
              setStep(QUESTIONS.length - 1);
              setView("exercise");
            }}
          />
        )}
      </div>
    </div>
  );
}

function Intro({
  assessment,
  ranked,
  onStart,
  onFresh,
  onResults,
}: {
  assessment: AssessmentRow | null;
  ranked: RankedValue[];
  onStart: () => void;
  onFresh: () => void;
  onResults: () => void;
}) {
  const draft = assessment?.status === "draft";
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <section className="relative overflow-hidden rounded-3xl border border-primary/15 bg-gradient-to-br from-primary/[0.1] via-card to-map-violet/[0.08] p-6 shadow-[0_18px_60px_-36px_oklch(0.25_0.08_270)] md:p-10">
        <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-primary/[0.08] blur-2xl" />
        <div className="relative max-w-3xl">
          <Badge variant="outline" className="mb-5 border-primary/20 bg-card/70 text-primary">
            <Compass className="mr-1.5 h-3.5 w-3.5" /> 10 klausimų · 30 įrodymų
          </Badge>
          <h2 className="font-serif text-4xl leading-tight tracking-tight md:text-5xl">
            Tavo gyvenimas jau rodo, kas tau svarbiausia.
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground">
            Šis pratimas remiasi realiu paskutinio mėnesio elgesiu: kur keliauja tavo laikas,
            energija, pinigai, dėmesys ir disciplina. Atsakyk konkrečiai ir sąžiningai — rezultato
            niekam nereikia įrodinėti.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Button size="lg" onClick={onStart}>
              {draft ? "Tęsti pratimą" : "Pradėti pratimą"}
              <ArrowRight />
            </Button>
            {assessment && (
              <Button size="lg" variant="outline" onClick={onFresh}>
                <RefreshCw /> Pradėti iš naujo
              </Button>
            )}
            {assessment?.status === "completed" && ranked.length > 0 && (
              <Button size="lg" variant="outline" onClick={onResults}>
                <Trophy /> Mano rezultatai
              </Button>
            )}
          </div>
          {draft && (
            <p className="mt-3 text-xs text-muted-foreground">
              Išsaugota: {new Date(assessment.updated_at).toLocaleString("lt-LT")}
            </p>
          )}
        </div>
      </section>
      <div className="grid gap-4 md:grid-cols-3">
        {[
          [
            "01",
            "Žiūrėk į dabartį",
            "Atsakyk pagal paskutinį mėnesį, ne pagal praeitį ar idealų ateities save.",
          ],
          [
            "02",
            "Būk konkretus",
            "„Darbas“ nėra atsakymas. Įvardyk konkrečią veiklą ir tai, ką ji tau suteikia.",
          ],
          [
            "03",
            "Ieškok pasikartojimų",
            "Ta pati vertybė pasirodys skirtingose gyvenimo vietose — tai ir yra svarbiausias signalas.",
          ],
        ].map(([number, title, text]) => (
          <Card key={number} className="p-5 md:p-6">
            <span className="font-serif text-2xl text-primary">{number}</span>
            <h3 className="mt-3 font-semibold">{title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{text}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}

function Exercise({
  step,
  answers,
  completion,
  complete,
  saving,
  onAnswer,
  onBack,
  onNext,
}: {
  step: number;
  answers: Answer[];
  completion: number;
  complete: boolean;
  saving: boolean;
  onAnswer: (position: number, field: "evidence" | "value", value: string) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const question = QUESTIONS[step];
  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="flex items-center gap-4">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex items-center justify-between text-xs font-medium">
            <span className="text-primary">
              Klausimas {step + 1} iš {QUESTIONS.length}
            </span>
            <span className="text-muted-foreground">{completion}% užpildyta</span>
          </div>
          <Progress value={completion} />
        </div>
      </div>
      <Card className="overflow-hidden border-primary/15">
        <div className="border-b border-border/60 bg-gradient-to-br from-primary/[0.08] to-transparent p-5 md:p-7">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-md">
              <span className="font-serif text-xl">{step + 1}</span>
            </div>
            <div>
              <h2 className="font-serif text-2xl md:text-3xl">{question.title}</h2>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                {question.prompt}
              </p>
            </div>
          </div>
        </div>
        <div className="space-y-4 p-4 md:p-7">
          {answers.map((answer) => (
            <div
              key={answer.position}
              className="rounded-2xl border border-border/75 bg-background/55 p-4 md:p-5"
            >
              <div className="mb-3 flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                  {answer.position + 1}
                </span>
                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Realus įrodymas
                </span>
              </div>
              <Input
                value={answer.evidence}
                onChange={(event) => onAnswer(answer.position, "evidence", event.target.value)}
                placeholder="Ką konkrečiai darai, renkiesi ar turi?"
              />
              <div className="mt-3 grid gap-2 sm:grid-cols-[auto_1fr] sm:items-center">
                <label className="text-sm font-medium">Kokią vertybę tai rodo?</label>
                <Input
                  value={answer.value}
                  onChange={(event) => onAnswer(answer.position, "value", event.target.value)}
                  placeholder="Pvz., mokymasis, šeimos ryšys, kūryba…"
                />
              </div>
            </div>
          ))}
          <div className="rounded-xl bg-muted/60 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
            <Sparkles className="mr-1.5 inline h-3.5 w-3.5 text-primary" />
            {question.hint}
          </div>
        </div>
      </Card>
      <div className="flex items-center justify-between gap-3">
        <Button variant="outline" onClick={onBack} disabled={step === 0 || saving}>
          <ArrowLeft /> Atgal
        </Button>
        <Button onClick={onNext} disabled={!complete || saving}>
          {saving ? (
            <Loader2 className="animate-spin" />
          ) : step === QUESTIONS.length - 1 ? (
            <Trophy />
          ) : (
            <ArrowRight />
          )}
          {step === QUESTIONS.length - 1 ? "Matyti hierarchiją" : "Išsaugoti ir tęsti"}
        </Button>
      </div>
    </div>
  );
}

function Results({
  ranked,
  saving,
  completed,
  onRename,
  onMove,
  onFinish,
  onBack,
}: {
  ranked: RankedValue[];
  saving: boolean;
  completed: boolean;
  onRename: (index: number, name: string) => void;
  onMove: (index: number, direction: -1 | 1) => void;
  onFinish: () => void;
  onBack: () => void;
}) {
  const max = Math.max(...ranked.map((item) => item.count), 1);
  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <section className="rounded-3xl border border-primary/15 bg-gradient-to-br from-primary/[0.1] via-card to-map-green/[0.07] p-6 md:p-8">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-white shadow-md">
          <Trophy />
        </div>
        <h2 className="mt-5 font-serif text-3xl md:text-4xl">Tavo vertybių hierarchija</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Daugiausia pasikartojimų turinčios temos yra aukščiau. Patikslink pavadinimus taip, kad
          jie būtų konkretūs tau — ne tik „šeima“, o, pavyzdžiui, „vaikų potencialo atskleidimas“.
        </p>
      </section>
      <div className="space-y-3">
        {ranked.map((value, index) => (
          <Card
            key={`${value.name}-${index}`}
            className={cn("p-4 md:p-5", index === 0 && "border-primary/25 bg-primary/[0.035]")}
          >
            <div className="flex items-start gap-3 md:gap-4">
              <div className="flex shrink-0 flex-col items-center gap-1">
                <div
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-xl font-serif text-xl",
                    index === 0 ? "bg-primary text-white" : "bg-muted text-muted-foreground",
                  )}
                >
                  {index + 1}
                </div>
                <div className="flex gap-0.5">
                  <button
                    type="button"
                    aria-label="Kelti aukštyn"
                    disabled={index === 0}
                    onClick={() => onMove(index, -1)}
                    className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-20"
                  >
                    <ChevronUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    aria-label="Leisti žemyn"
                    disabled={index === ranked.length - 1}
                    onClick={() => onMove(index, 1)}
                    className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-20"
                  >
                    <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <div className="relative flex-1">
                    <Edit3 className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={value.name}
                      onChange={(event) => onRename(index, event.target.value)}
                      className="pl-9 font-semibold"
                    />
                  </div>
                  <Badge variant="secondary" className="self-start sm:self-auto">
                    {value.count} iš 30 atsakymų
                  </Badge>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-primary to-map-violet"
                    style={{ width: `${(value.count / max) * 100}%` }}
                  />
                </div>
                <details className="mt-3 text-xs text-muted-foreground">
                  <summary className="cursor-pointer font-medium hover:text-foreground">
                    Rodyti {value.evidence.length} įrodymus
                  </summary>
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    {value.evidence.map((evidence, evidenceIndex) => (
                      <li key={`${evidence}-${evidenceIndex}`}>{evidence}</li>
                    ))}
                  </ul>
                </details>
              </div>
            </div>
          </Card>
        ))}
      </div>
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft /> Patikslinti atsakymus
        </Button>
        <div className="flex flex-col gap-3 sm:flex-row">
          {completed && (
            <Button asChild variant="outline">
              <Link to="/goals">
                <CheckCircle2 /> Naudoti tiksluose
              </Link>
            </Button>
          )}
          <Button onClick={onFinish} disabled={saving || ranked.length < 2}>
            {saving ? <Loader2 className="animate-spin" /> : <Save />}
            {completed ? "Atnaujinti hierarchiją" : "Išsaugoti hierarchiją"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function mergeAnswers(saved: Answer[]) {
  return EMPTY_ANSWERS.map(
    (empty) =>
      saved.find(
        (answer) => answer.question === empty.question && answer.position === empty.position,
      ) ?? empty,
  );
}

function readLocalDraft(): AssessmentRow | null {
  try {
    const raw = localStorage.getItem(LOCAL_DRAFT_KEY);
    return raw ? (JSON.parse(raw) as AssessmentRow) : null;
  } catch {
    return null;
  }
}

function writeLocalDraft(row: AssessmentRow) {
  localStorage.setItem(LOCAL_DRAFT_KEY, JSON.stringify(row));
}
