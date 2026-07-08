import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Mic,
  MicOff,
  Send,
  Loader2,
  Circle,
  Sparkles,
  Quote,
  Radio,
  Flame,
  Activity,
  Layers,
  Settings2,
  ChevronRight,
  Table2,
  Map as MapIcon,
  Puzzle,
  Ear,
  HelpCircle,
  Paperclip,
  Smile,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { GrowthMap, GrowthMapBody, type SessionMapData } from "@/components/growth-map";
import { GoalClarifier, GoalClarifierBody, type GoalClarifierData } from "@/components/goal-clarifier";
import { NewSessionDialog, type SessionMode } from "@/components/new-session-dialog";
import { extractMapPayload } from "@/lib/parse-ai-payload";
import { extractGoalPayload } from "@/lib/parse-goal-payload";
import { AnalysisCard, UserCard } from "@/components/analysis-card";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { SessionCompletionDialog } from "@/components/session-completion-dialog";
import { CheckCircle2, Compass, BookOpen } from "lucide-react";


export const Route = createFileRoute("/_authenticated/session")({
  validateSearch: (s: Record<string, unknown>) => ({
    s: typeof s.s === "string" ? s.s : undefined,
  }),
  component: SessionPage,
});

type Message = { id: string; role: "user" | "assistant"; content: string; created_at?: string };
type SessionRow = {
  id: string;
  title: string;
  status: string;
  mode: SessionMode;
  active_topic: string | null;
  active_column: string | null;
  active_belief: string | null;
  emotional_current: number | null;
  emotional_start: number | null;
  patterns: string[] | null;
  grid: Record<string, string> | null;
  updated_at: string;
  created_at: string;
};

const TABS = [
  { key: "session", label: "Sesija", icon: Radio },
  { key: "table", label: "Lentelė", icon: Table2 },
  { key: "map", label: "Žemėlapis", icon: MapIcon },
  { key: "integration", label: "Integracija", icon: Puzzle },
] as const;


function SessionPage() {
  const navigate = useNavigate();
  const { s: sidFromUrl } = Route.useSearch();
  const [session, setSession] = useState<SessionRow | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("session");
  const scrollRef = useRef<HTMLDivElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [completionOpen, setCompletionOpen] = useState(false);
  const [newSessionOpen, setNewSessionOpen] = useState(false);
  const [savingGoal, setSavingGoal] = useState(false);
  const [mapSheetOpen, setMapSheetOpen] = useState(false);


  const mode: SessionMode = (session?.mode as SessionMode) ?? "demartini";

  // Load or bootstrap active session
  useEffect(() => {
    (async () => {
      if (sidFromUrl) {
        await loadSession(sidFromUrl);
      } else {
        const { data } = await supabase
          .from("sessions")
          .select("id")
          .order("updated_at", { ascending: false })
          .limit(1);
        if (data && data.length > 0) {
          navigate({ to: "/session", search: { s: data[0].id }, replace: true });
        } else {
          // No sessions yet — ask user which mode
          setNewSessionOpen(true);
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sidFromUrl]);

  async function createSession(pickedMode: SessionMode) {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    const title =
      pickedMode === "goal_clarify"
        ? "Tikslo išgryninimas"
        : pickedMode === "mentor"
          ? "Klausk mentoriaus"
          : "Nauja sesija";
    const { data: created, error } = await supabase
      .from("sessions")
      .insert({ user_id: userData.user.id, title, mode: pickedMode })
      .select("id")
      .single();
    if (error) return toast.error(error.message);
    setNewSessionOpen(false);
    navigate({ to: "/session", search: { s: created.id } });
  }


  async function loadSession(id: string) {
    const [{ data: srow }, { data: mrows }] = await Promise.all([
      supabase.from("sessions").select("*").eq("id", id).single(),
      supabase
        .from("messages")
        .select("id, role, content, created_at")
        .eq("session_id", id)
        .order("created_at", { ascending: true }),
    ]);
    setSession(srow as SessionRow | null);
    setMessages(((mrows as Message[]) ?? []).map(cleanMessage));
  }

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, streaming]);

  const mapData: SessionMapData = {
    topic: session?.active_topic ?? null,
    belief: session?.active_belief ?? null,
    emotion: session?.emotional_current ?? null,
    column: session?.active_column ?? null,
    patterns: (session?.patterns as string[] | null) ?? [],
    grid: (session?.grid as Record<string, string> | null) ?? {},
  };


  const grid = (session?.grid as Record<string, string> | null) ?? {};
  const goalData: GoalClarifierData = {
    stage: session?.active_column ?? null,
    goal_draft: grid["goal_draft"] ?? session?.active_topic ?? null,
    why: grid["goal_why"] ?? null,
    value: grid["goal_value"] ?? null,
    benefits: grid["goal_benefits"] ?? null,
    costs: grid["goal_costs"] ?? null,
    obstacles: grid["goal_obstacles"] ?? null,
    first_step: grid["goal_first_step"] ?? null,
    ready_to_save: grid["goal_ready"] === "true",
    patterns: (session?.patterns as string[] | null) ?? [],
  };

  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  const focusQuote = lastUser?.content?.split(/[.!?]/)[0]?.trim() || "Kokia mintis dabar giliausiai kalba?";

  async function sendMessage(e?: FormEvent) {
    e?.preventDefault();
    const text = input.trim();
    if (!text || streaming || !session) return;

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    const userMsg: Message = { id: `tmp-${Date.now()}`, role: "user", content: text };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setStreaming(true);


    await supabase.from("messages").insert({
      session_id: session.id,
      user_id: userData.user.id,
      role: "user",
      content: text,
    });

    if (messages.length === 0) {
      const title = text.slice(0, 60);
      await supabase.from("sessions").update({ title }).eq("id", session.id);
      setSession((s) => (s ? { ...s, title } : s));
    }

    const history = [...messages, userMsg].map((m) => ({ role: m.role, content: m.content }));
    const assistantId = `tmp-a-${Date.now()}`;
    setMessages((m) => [...m, { id: assistantId, role: "assistant", content: "" }]);

    try {
      let resp: Response;
      if (mode === "mentor") {
        const { data: sess } = await supabase.auth.getSession();
        const token = sess.session?.access_token;
        if (!token) throw new Error("Nesi prisijungęs");
        resp = await fetch("/api/mentor-chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ messages: history }),
        });
      } else {
        resp = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: history, mode }),
        });
      }
      if (!resp.ok || !resp.body) throw new Error(await resp.text().catch(() => "AI klaida"));

      const parse = (raw: string) => {
        if (mode === "goal_clarify") return extractGoalPayload(raw);
        if (mode === "demartini") return extractMapPayload(raw);
        return { clean: raw, payload: null } as const;
      };

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let full = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        full += decoder.decode(value, { stream: true });
        const { clean } = parse(full);
        setMessages((m) => m.map((x) => (x.id === assistantId ? { ...x, content: clean } : x)));
      }

      const { clean, payload } = parse(full);
      await supabase.from("messages").insert({
        session_id: session.id,
        user_id: userData.user.id,
        role: "assistant",
        content: clean,
      });

      if (payload) {
        const updates: Partial<SessionRow> = { updated_at: new Date().toISOString() };
        if (mode === "demartini") {
          const p = payload as import("@/lib/parse-ai-payload").MapPayload;
          if (p.topic) updates.active_topic = p.topic;
          if (p.belief) updates.active_belief = p.belief;
          if (p.column) updates.active_column = p.column;
          if (typeof p.emotion === "number") {
            updates.emotional_current = p.emotion;
            if (session.emotional_start == null) updates.emotional_start = p.emotion;
          }
          if (p.patterns) updates.patterns = p.patterns;
          if (p.grid) updates.grid = { ...(session.grid ?? {}), ...p.grid };
        } else if (mode === "goal_clarify") {
          const p = payload as import("@/lib/parse-goal-payload").GoalPayload;
          if (p.stage) updates.active_column = p.stage;
          if (p.goal_draft) updates.active_topic = p.goal_draft;
          if (p.patterns) updates.patterns = p.patterns;
          const gridUpdate: Record<string, string> = { ...(session.grid ?? {}) };
          if (p.goal_draft) gridUpdate["goal_draft"] = p.goal_draft;
          if (p.why) gridUpdate["goal_why"] = p.why;
          if (p.value) gridUpdate["goal_value"] = p.value;
          if (p.benefits) gridUpdate["goal_benefits"] = p.benefits;
          if (p.costs) gridUpdate["goal_costs"] = p.costs;
          if (p.obstacles) gridUpdate["goal_obstacles"] = p.obstacles;
          if (p.first_step) gridUpdate["goal_first_step"] = p.first_step;
          if (typeof p.ready_to_save === "boolean")
            gridUpdate["goal_ready"] = String(p.ready_to_save);
          updates.grid = gridUpdate;
        }
        const { data: updated } = await supabase
          .from("sessions")
          .update(updates)
          .eq("id", session.id)
          .select("*")
          .single();
        if (updated) setSession(updated as SessionRow);
      }

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "AI klaida";
      toast.error(msg);
      setMessages((m) => m.filter((x) => x.id !== assistantId));
    } finally {
      setStreaming(false);
    }
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4";
      const rec = new MediaRecorder(stream, { mimeType: mime });
      chunksRef.current = [];
      rec.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: mime });
        if (blob.size < 1000) {
          toast.error("Įrašas per trumpas");
          return;
        }
        setTranscribing(true);
        try {
          const fd = new FormData();
          fd.append("file", blob, `rec.${mime.includes("webm") ? "webm" : "mp4"}`);
          const resp = await fetch("/api/transcribe", { method: "POST", body: fd });
          if (!resp.ok) throw new Error(await resp.text());
          const { text } = await resp.json();
          setInput((p) => (p ? p + " " + text : text));
        } catch (err: unknown) {
          const m = err instanceof Error ? err.message : "Transkripcijos klaida";
          toast.error(m);
        } finally {
          setTranscribing(false);
        }
      };
      rec.start();
      recorderRef.current = rec;
      setRecording(true);
    } catch (err: unknown) {
      const m = err instanceof Error ? err.message : "Nepavyko pasiekti mikrofono";
      toast.error(m);
    }
  }

  function stopRecording() {
    recorderRef.current?.stop();
    recorderRef.current = null;
    setRecording(false);
  }

  async function saveGoal() {
    if (!session || !goalData.goal_draft) return;
    setSavingGoal(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const descParts: string[] = [];
      if (goalData.why) descParts.push(`Kodėl: ${goalData.why}`);
      if (goalData.value) descParts.push(`Aukščiausia vertybė: ${goalData.value}`);
      if (goalData.benefits) descParts.push(`Nauda: ${goalData.benefits}`);
      if (goalData.costs) descParts.push(`Kaina: ${goalData.costs}`);
      if (goalData.obstacles) descParts.push(`Kliūtys: ${goalData.obstacles}`);

      const { data: goal, error: gErr } = await supabase
        .from("goals")
        .insert({
          user_id: userData.user.id,
          title: goalData.goal_draft.slice(0, 200),
          description: descParts.join("\n\n") || null,
        })
        .select("id")
        .single();
      if (gErr) throw gErr;

      if (goalData.first_step) {
        const due = new Date();
        due.setDate(due.getDate() + 3);
        await supabase.from("priorities").insert({
          user_id: userData.user.id,
          title: goalData.first_step.slice(0, 200),
          due_date: due.toISOString().slice(0, 10),
          linked_goal_id: goal?.id ?? null,
        });
      }

      // AI iškaido tikslą į hierarchinį užduočių medį
      toast.message("AI skaido tikslą į užduotis…");
      try {
        const resp = await fetch("/api/goal-breakdown", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            goal_title: goalData.goal_draft,
            goal_description: descParts.join("\n\n") || null,
            why: goalData.why,
            value: goalData.value,
            benefits: goalData.benefits,
            costs: goalData.costs,
            obstacles: goalData.obstacles,
            first_step: goalData.first_step,
          }),
        });
        if (resp.ok && goal?.id) {
          const breakdown = (await resp.json()) as import("@/lib/insert-task-tree").AIBreakdown;
          const { insertTaskTree } = await import("@/lib/insert-task-tree");
          const n = await insertTaskTree({
            userId: userData.user.id,
            goalId: goal.id,
            breakdown,
          });
          if (n > 0) toast.success(`Sukurta ${n} užduočių tavo tiksle`);
        }
      } catch (e) {
        console.error("goal-breakdown failed", e);
      }

      toast.success("Tikslas įrašytas į Tikslus");
      navigate({ to: "/goals" });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Nepavyko išsaugoti");
    } finally {
      setSavingGoal(false);
    }
  }

  const currentTime = new Date().toLocaleTimeString("lt-LT", { hour: "2-digit", minute: "2-digit" });


  return (
    <div className="flex flex-1 min-h-0">
      {/* Center column */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Header */}
        <header className="border-b bg-background/80 backdrop-blur px-4 md:px-6 py-3 md:py-4">
          <div className="flex items-start gap-2 md:gap-3">
            <SidebarTrigger className="mt-1 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="font-serif text-xl md:text-3xl leading-tight text-foreground truncate max-w-full">
                  {session?.title ?? "Gyva augimo sesija"}
                </h1>
                <ModeBadge mode={mode} />
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1 flex-wrap">
                <span className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-map-green animate-pulse" />
                  Sesija aktyvi
                </span>
                <span>· {currentTime}</span>
              </div>
              <p className="hidden md:block text-sm text-muted-foreground mt-1">
                {mode === "goal_clarify"
                  ? "Vedlys išgrynina tavo tikslą per 8 etapus – nuo neapdirbto noro iki pirmo veiksmo."
                  : mode === "mentor"
                    ? "Mentorius atsako iš tavo įkeltos medžiagos su citatomis."
                    : "AI klauso, atspindi, perklausia ir pildo tavo augimo žemėlapį."}
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <Button
                onClick={() => setNewSessionOpen(true)}
                variant="outline"
                size="sm"
                className="gap-1.5 h-9 px-2 md:px-3"
                title="Pradėti naują sesiją"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span className="hidden md:inline">Nauja</span>
              </Button>
              {mode === "demartini" && (
                <Button
                  onClick={() => setCompletionOpen(true)}
                  size="sm"
                  className="gap-1.5 h-9 px-2 md:px-3"
                  disabled={!session || messages.length < 2}
                  title="Užbaigti ir suplanuoti"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span className="hidden md:inline">Užbaigti</span>
                </Button>
              )}
              {mode === "goal_clarify" && (
                <Button
                  onClick={saveGoal}
                  size="sm"
                  className="gap-1.5 h-9 px-2 md:px-3"
                  disabled={!session || !goalData.goal_draft || savingGoal}
                  title="Perkelti į Tikslus"
                >
                  {savingGoal ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  )}
                  <span className="hidden md:inline">Perkelti</span>
                </Button>
              )}
              {(mode === "demartini" || mode === "goal_clarify") && (
                <Button
                  variant="outline"
                  size="sm"
                  className="lg:hidden h-9 w-9 p-0"
                  onClick={() => setMapSheetOpen(true)}
                  title="Augimo žemėlapis"
                >
                  <MapIcon className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </header>


        {/* Tabs */}
        <div className="border-b bg-background px-4 md:px-6 overflow-x-auto">
          <div className="flex gap-4 md:gap-6 min-w-max">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  "flex items-center gap-1.5 py-3 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap",
                  tab === t.key
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                <t.icon className="h-4 w-4" />
                {t.label}
              </button>
            ))}
          </div>
        </div>


        {/* Body */}
        <div className="flex-1 min-h-0 overflow-hidden bg-muted/20">
          {tab === "session" && (
            <div ref={scrollRef} className="h-full overflow-y-auto">
              <div className="max-w-3xl mx-auto px-6 py-6 space-y-4">
                {/* Sesijos pulsas */}
                <Card className="p-4">
                  <div className="flex items-center gap-2 text-sm font-medium mb-3">
                    <Activity className="h-4 w-4 text-map-green" />
                    Sesijos pulsas
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <PulseBadge icon={<Ear className="h-3 w-3" />} tone="map-green">
                      {streaming ? "AI analizuoja…" : "Klausausi"}
                    </PulseBadge>
                    {mode === "demartini" && (
                      <>
                        {mapData.topic && (
                          <PulseBadge icon={<Circle className="h-3 w-3 fill-current" />} tone="map-blue">
                            Aktyvi tema: {mapData.topic}
                          </PulseBadge>
                        )}
                        {mapData.emotion != null && (
                          <PulseBadge icon={<Flame className="h-3 w-3" />} tone="map-orange">
                            Emocinis krūvis: {mapData.emotion}/10
                          </PulseBadge>
                        )}
                        {mapData.column && (
                          <PulseBadge icon={<Layers className="h-3 w-3" />} tone="map-violet">
                            Aktyvus modulis: {mapData.column}
                          </PulseBadge>
                        )}
                      </>
                    )}
                    {mode === "goal_clarify" && (
                      <>
                        {goalData.stage && (
                          <PulseBadge icon={<Layers className="h-3 w-3" />} tone="map-violet">
                            Etapas: {goalData.stage}
                          </PulseBadge>
                        )}
                        {goalData.goal_draft && (
                          <PulseBadge icon={<Circle className="h-3 w-3 fill-current" />} tone="map-blue">
                            Tikslas: {goalData.goal_draft.slice(0, 60)}
                          </PulseBadge>
                        )}
                        {goalData.value && (
                          <PulseBadge icon={<Sparkles className="h-3 w-3" />} tone="map-teal">
                            Vertybė: {goalData.value}
                          </PulseBadge>
                        )}
                      </>
                    )}
                  </div>
                </Card>

                {/* Gyvas fokusas – tik demartini režime */}
                {mode === "demartini" && messages.length > 0 && (
                  <Card className="p-6 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
                    <div className="flex items-center gap-2 mb-3">
                      <Sparkles className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium">Gyvas fokusas</span>
                      <span className="text-xs text-muted-foreground">· Sustokime čia</span>
                    </div>
                    <div className="text-center py-3">
                      <Quote className="h-6 w-6 text-primary/40 mx-auto mb-2" />
                      <blockquote className="font-serif text-2xl leading-snug text-foreground max-w-xl mx-auto">
                        „{focusQuote}."
                      </blockquote>
                      <p className="text-sm text-muted-foreground mt-3 max-w-md mx-auto">
                        Tai atrodo kaip giluminis įsitikinimas, kuris stipriai tave stabdo.
                      </p>
                    </div>
                    <div className="flex gap-2 justify-center mt-4 flex-wrap">
                      <Button size="sm" className="gap-1.5">
                        <Sparkles className="h-3.5 w-3.5" /> Gilinam šią vietą
                      </Button>
                      <Button size="sm" variant="outline" className="gap-1.5">
                        <HelpCircle className="h-3.5 w-3.5" /> Paaiškink paprasčiau
                      </Button>
                      <Button size="sm" variant="outline" className="gap-1.5">
                        Eikime toliau <ChevronRight className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </Card>
                )}

                {messages.length === 0 && (
                  <Card className="p-10 text-center border-dashed">
                    <div className={cn(
                      "h-14 w-14 rounded-2xl mx-auto mb-4 flex items-center justify-center",
                      mode === "goal_clarify" ? "bg-primary/10 text-primary" : "bg-primary/10 text-primary",
                    )}>
                      {mode === "goal_clarify" ? <Compass className="h-7 w-7" /> : <Sparkles className="h-7 w-7" />}
                    </div>
                    <h2 className="font-serif text-2xl">
                      {mode === "goal_clarify" ? "Pradėk tikslo išgryninimą" : "Pradėk savirefleksijos sesiją"}
                    </h2>
                    <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
                      {mode === "goal_clarify"
                        ? "Parašyk savo norą ar tikslą tokį, kokį jį girdi galvoje. Vedlys per 8 etapus jį padarys konkretų, subalansuotą su tavo vertybėmis ir su pirmu žingsniu."
                        : "Parašyk arba pasakyk temą, su kuria šiandien nori padirbėti. Vedlys ves tave po vieną žingsnį per 11 Demartini metodo etapų."}
                    </p>
                  </Card>
                )}


                {/* Messages */}
                {messages.map((m) => (
                  <MessageBubble key={m.id} message={m} />
                ))}

                {streaming && lastAssistant?.content === "" && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> AI ruošia atsakymą…
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === "table" && <TableView data={mapData} />}
          {tab === "map" && (
            <PlaceholderView icon={MapIcon} title="Žemėlapio vaizdas">
              Pilnas vizualus 14 stulpelių žemėlapis. Netrukus.
            </PlaceholderView>
          )}
          {tab === "integration" && (
            <PlaceholderView icon={Puzzle} title="Integracija su tikslais">
              Susiek sesijos įžvalgas su savo tikslais, prioritetais ir vizija.
            </PlaceholderView>
          )}
        </div>

        {/* Composer */}
        <form onSubmit={sendMessage} className="border-t bg-background p-3 md:p-4">
          <div className="max-w-3xl mx-auto">
            <Card className="p-2.5 md:p-3 flex items-start gap-2 md:gap-3">

              <button
                type="button"
                onClick={recording ? stopRecording : startRecording}
                disabled={streaming || transcribing}
                className={cn(
                  "h-10 w-10 md:h-11 md:w-11 rounded-xl flex items-center justify-center shrink-0 border transition-colors",
                  recording
                    ? "bg-destructive text-destructive-foreground border-destructive"
                    : "bg-muted hover:bg-accent",
                )}
                title={recording ? "Sustabdyti įrašymą" : "Įrašyti balsu"}
              >
                {transcribing ? (
                  <Loader2 className="h-4 w-4 md:h-5 md:w-5 animate-spin" />
                ) : recording ? (
                  <MicOff className="h-4 w-4 md:h-5 md:w-5" />
                ) : (
                  <Mic className="h-4 w-4 md:h-5 md:w-5" />
                )}
              </button>


              <div className="flex-1 min-w-0">
                <div className="hidden md:flex items-center gap-2 text-xs text-muted-foreground mb-1">
                  <span className="flex items-center gap-1">
                    <span className={cn("h-1.5 w-1.5 rounded-full", recording ? "bg-destructive animate-pulse" : "bg-map-green")} />
                    {recording ? "Įrašoma…" : "Balso režimas aktyvus"}
                  </span>
                  <span>·</span>
                  <span>AI klausosi</span>
                </div>
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Pasakyk, kas dabar kyla mintyse…"
                  rows={2}
                  disabled={streaming || transcribing}
                  className="resize-none border-0 shadow-none focus-visible:ring-0 p-0 text-base min-h-[44px]"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                />
                <div className="hidden md:flex items-center gap-2 mt-2 text-muted-foreground">
                  <button type="button" className="p-1 hover:text-foreground" title="Priedas">
                    <Paperclip className="h-4 w-4" />
                  </button>
                  <button type="button" className="p-1 hover:text-foreground" title="Emoji">
                    <Smile className="h-4 w-4" />
                  </button>
                  <span className="ml-auto text-[11px]">
                    Enter — siųsti, Shift + Enter — nauja eilutė
                  </span>
                </div>
              </div>


              <Button
                type="submit"
                disabled={streaming || !input.trim()}
                className="h-11 gap-1.5 shrink-0 px-3 md:px-4"
              >
                {streaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                <span className="hidden md:inline">Siųsti</span>
              </Button>
            </Card>
          </div>
        </form>
      </div>

      {/* Right panel — desktop */}
      {mode === "goal_clarify" ? (
        <GoalClarifier data={goalData} onSave={saveGoal} />
      ) : mode === "demartini" ? (
        <GrowthMap data={mapData} />
      ) : null}

      {/* Mobile map sheet */}
      {(mode === "demartini" || mode === "goal_clarify") && (
        <Sheet open={mapSheetOpen} onOpenChange={setMapSheetOpen}>
          <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
            <SheetHeader className="px-4 py-3 border-b">
              <SheetTitle className="text-left font-serif text-lg">
                {mode === "goal_clarify" ? "Tikslo išgryninimas" : "Augimo žemėlapis"}
              </SheetTitle>
            </SheetHeader>
            <div className="flex-1 min-h-0 overflow-y-auto flex flex-col">
              {mode === "goal_clarify" ? (
                <GoalClarifierBody data={goalData} onSave={saveGoal} />
              ) : (
                <GrowthMapBody data={mapData} />
              )}
            </div>
          </SheetContent>
        </Sheet>
      )}


      {session && mode === "demartini" && (
        <SessionCompletionDialog
          open={completionOpen}
          onOpenChange={setCompletionOpen}
          sessionId={session.id}
          sessionTitle={session.title}
          sessionTopic={session.active_topic}
          context={{
            topic: session.active_topic,
            belief: session.active_belief,
            column: session.active_column,
            emotion: session.emotional_current,
            patterns: session.patterns,
            messages: messages.map((m) => ({ role: m.role, content: m.content })),
          }}
          onComplete={() => navigate({ to: "/priorities" })}
        />
      )}

      <NewSessionDialog
        open={newSessionOpen}
        onOpenChange={setNewSessionOpen}
        onPick={createSession}
      />
    </div>
  );
}

function ModeBadge({ mode }: { mode: SessionMode }) {
  const cfg =
    mode === "goal_clarify"
      ? { label: "Tikslo išgryninimas", tone: "map-teal", Icon: Compass }
      : mode === "mentor"
        ? { label: "Mentorius", tone: "map-teal", Icon: BookOpen }
        : { label: "Emocinis balansas", tone: "map-orange", Icon: Sparkles };
  const { Icon } = cfg;
  return (
    <Badge
      variant="outline"
      className="gap-1.5 py-1 px-2 font-normal text-[11px] rounded-full"
      style={{
        color: `var(--color-${cfg.tone})`,
        borderColor: `color-mix(in oklab, var(--color-${cfg.tone}) 35%, transparent)`,
        backgroundColor: `color-mix(in oklab, var(--color-${cfg.tone}) 10%, transparent)`,
      }}
    >
      <Icon className="h-3 w-3" />
      {cfg.label}
    </Badge>
  );
}

function PulseBadge({
  children,
  icon,
  tone,
}: {
  children: React.ReactNode;
  icon: React.ReactNode;
  tone: string;
}) {
  return (
    <Badge
      variant="outline"
      className="gap-1.5 py-1.5 px-2.5 font-normal rounded-full border"
      style={{ color: `var(--color-${tone})`, borderColor: `color-mix(in oklab, var(--color-${tone}) 30%, transparent)`, backgroundColor: `color-mix(in oklab, var(--color-${tone}) 8%, transparent)` }}
    >
      {icon}
      {children}
    </Badge>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const time = message.created_at
    ? new Date(message.created_at).toLocaleTimeString("lt-LT", { hour: "2-digit", minute: "2-digit" })
    : "dabar";

  if (message.role === "user") {
    return <UserCard content={message.content} time={time} />;
  }
  return <AnalysisCard content={message.content} time={time} />;
}


function cleanMessage(m: Message): Message {
  const { clean: c1 } = extractMapPayload(m.content);
  const { clean: c2 } = extractGoalPayload(c1);
  return { ...m, content: c2 };
}

function TableView({ data }: { data: SessionMapData }) {
  const rows = [
    ["Situacija", data.grid.Situacija],
    ["Emocija", data.grid.Emocija],
    ["Problemos sakinys", data.grid["Problemos sakinys"]],
    ["Paslėptos naudos", data.grid.Naudos],
    ["Vertybės", data.grid.Vertybės],
    ["Integracija", data.grid.Integracija],
  ] as const;
  return (
    <div className="max-w-3xl mx-auto p-6">
      <Card className="overflow-hidden">
        <div className="p-5 border-b">
          <h2 className="font-serif text-2xl">Demartini lentelė</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Realiu laiku pildoma pagal pokalbio tėkmę.
          </p>
        </div>
        <div className="divide-y">
          {rows.map(([label, value]) => (
            <div key={label} className="grid grid-cols-[200px_1fr] gap-4 px-5 py-4">
              <div className="text-sm font-medium text-primary">{label}</div>
              <div className="text-sm text-foreground/90">
                {value || <span className="text-muted-foreground italic">Dar neužpildyta</span>}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function PlaceholderView({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof MapIcon;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="max-w-2xl mx-auto p-12 text-center">
      <div className="h-14 w-14 rounded-2xl bg-primary/10 text-primary mx-auto flex items-center justify-center mb-4">
        <Icon className="h-7 w-7" />
      </div>
      <h2 className="font-serif text-2xl">{title}</h2>
      <p className="text-sm text-muted-foreground mt-2">{children}</p>
    </div>
  );
}

