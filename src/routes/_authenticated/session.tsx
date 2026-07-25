import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Mic, MicOff, Send, Loader2, Sparkles, CheckCircle2, Compass } from "lucide-react";
import { cn } from "@/lib/utils";
import { GrowthMapBody, type SessionMapData } from "@/components/growth-map";
import {
  GoalClarifier,
  GoalClarifierBody,
  type GoalClarifierData,
} from "@/components/goal-clarifier";
import { NewSessionDialog, type SessionMode } from "@/components/new-session-dialog";
import { extractMapPayload } from "@/lib/parse-ai-payload";
import { extractGoalPayload } from "@/lib/parse-goal-payload";
import { AnalysisCard, UserCard, detectStageFromMessages } from "@/components/analysis-card";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { SessionCompletionDialog } from "@/components/session-completion-dialog";
import { SessionIntegration } from "@/components/session-integration";

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
  { key: "session", label: "Dabartinis žingsnis" },
  { key: "table", label: "Lentelė" },
  { key: "map", label: "Augimo žemėlapis" },
  { key: "integration", label: "Integracija" },
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
    const frame = requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: streaming ? "smooth" : "auto",
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [messages, streaming]);

  const grid = (session?.grid as Record<string, string> | null) ?? {};
  const mapData: SessionMapData = {
    topic: session?.active_topic ?? null,
    belief: session?.active_belief ?? null,
    emotion: session?.emotional_current ?? null,
    column: session?.active_column ?? null,
    patterns: (session?.patterns as string[] | null) ?? [],
    grid: (session?.grid as Record<string, string> | null) ?? {},
    touchedValue: grid["Paliesta vertybė"] ?? null,
    valueConflict:
      grid["Vertybių konfliktas A"] && grid["Vertybių konfliktas B"]
        ? { left: grid["Vertybių konfliktas A"], right: grid["Vertybių konfliktas B"] }
        : null,
    valueDynamic: grid["Vertybinė dinamika"] ?? null,
    valueDynamicEvidence: grid["Vertybinės dinamikos pagrindas"] ?? null,
  };

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
  const currentStage = detectStageFromMessages(messages);

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
        const { data: sess } = await supabase.auth.getSession();
        const token = sess.session?.access_token;
        if (!token) throw new Error("Nesi prisijungęs");
        resp = await fetch("/api/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
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
          const gridUpdate = { ...(updates.grid ?? session.grid ?? {}) } as Record<string, string>;
          if (p.touched_value) gridUpdate["Paliesta vertybė"] = p.touched_value;
          if (p.value_conflict?.left && p.value_conflict?.right) {
            gridUpdate["Vertybių konfliktas A"] = p.value_conflict.left;
            gridUpdate["Vertybių konfliktas B"] = p.value_conflict.right;
          }
          if (p.value_dynamic) gridUpdate["Vertybinė dinamika"] = p.value_dynamic;
          if (p.value_dynamic_evidence)
            gridUpdate["Vertybinės dinamikos pagrindas"] = p.value_dynamic_evidence;
          updates.grid = gridUpdate;
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

  const currentTime = new Date().toLocaleTimeString("lt-LT", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="flex h-[calc(100dvh-64px)] min-h-0 flex-1 overflow-hidden md:h-[100dvh]">
      {/* Center column */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="z-20 shrink-0 border-b border-border/70 bg-background/80 px-3 py-3 backdrop-blur-xl md:px-6 md:py-4">
          <div className="flex items-start gap-2 md:gap-3">
            <SidebarTrigger className="mt-1 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="font-serif text-xl font-semibold leading-tight text-foreground truncate max-w-full md:text-3xl">
                  {session?.title ?? "Gyva augimo sesija"}
                </h1>
              </div>
              <div className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                <span>{modeLabel(mode)}</span>
                {mode === "demartini" && <span>· {currentStage} etapas iš 11</span>}
                <span>·</span>
                <span className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-map-green animate-pulse" />
                  Sesija aktyvi
                </span>
                <span>· {currentTime}</span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <select
                value={tab}
                onChange={(event) => setTab(event.target.value as (typeof TABS)[number]["key"])}
                className="h-9 max-w-[118px] rounded-lg border border-border bg-background px-2 text-xs text-muted-foreground outline-none transition focus:border-primary/50 md:max-w-none md:px-2.5"
                aria-label="Sesijos vaizdas"
              >
                {TABS.map((item) => (
                  <option key={item.key} value={item.key}>
                    {item.label}
                  </option>
                ))}
              </select>
              {mode === "demartini" && (
                <Button
                  onClick={() => setCompletionOpen(true)}
                  size="sm"
                  className="gap-1.5 h-9 px-2 md:px-3"
                  disabled={!session || messages.length < 2}
                  title="Užbaigti ir suplanuoti"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span className="hidden md:inline">Baigti sesiją</span>
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
            </div>
          </div>
        </header>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-hidden bg-transparent">
          {tab === "session" && (
            <div ref={scrollRef} className="h-full overflow-y-auto">
              <div className="mx-auto max-w-6xl space-y-5 px-3 py-5 md:px-6 md:py-7">
                {messages.length === 0 && (
                  <Card className="p-6 md:p-10 text-center border-dashed">
                    <div
                      className={cn(
                        "h-12 w-12 md:h-14 md:w-14 rounded-2xl mx-auto mb-4 flex items-center justify-center",
                        "bg-primary/10 text-primary",
                      )}
                    >
                      {mode === "goal_clarify" ? (
                        <Compass className="h-6 w-6 md:h-7 md:w-7" />
                      ) : (
                        <Sparkles className="h-6 w-6 md:h-7 md:w-7" />
                      )}
                    </div>
                    <h2 className="font-serif text-xl md:text-2xl">
                      {mode === "goal_clarify"
                        ? "Pradėk tikslo išgryninimą"
                        : "Pradėk savirefleksijos sesiją"}
                    </h2>
                    <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
                      {mode === "goal_clarify"
                        ? "Parašyk savo norą ar tikslą tokį, kokį jį girdi galvoje. Vedlys per 8 etapus jį padarys konkretų."
                        : "Parašyk arba pasakyk temą, su kuria šiandien nori padirbėti."}
                    </p>
                  </Card>
                )}

                {lastAssistant && (
                  <AnalysisCard
                    content={lastAssistant.content}
                    time={
                      lastAssistant.created_at
                        ? new Date(lastAssistant.created_at).toLocaleTimeString("lt-LT", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : undefined
                    }
                    emotionValue={mapData.emotion}
                  />
                )}

                {messages.length > 2 && (
                  <details className="group rounded-2xl border border-border/70 bg-card/55 px-4 py-3">
                    <summary className="cursor-pointer list-none text-sm font-medium text-muted-foreground transition hover:text-foreground">
                      Ankstesnis pokalbis · {Math.max(messages.length - 1, 0)} žinutės
                    </summary>
                    <div className="mt-4 space-y-4 border-t pt-4">
                      {messages.slice(0, -1).map((message) => (
                        <MessageBubble key={message.id} message={message} />
                      ))}
                    </div>
                  </details>
                )}

                {streaming && lastAssistant?.content === "" && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> AI ruošia atsakymą…
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === "table" && <TableView data={mapData} />}
          {tab === "map" &&
            (mode === "goal_clarify" ? (
              <GoalClarifierBody data={goalData} onSave={saveGoal} />
            ) : (
              <div className="mx-auto max-w-3xl">
                <GrowthMapBody data={mapData} />
              </div>
            ))}
          {tab === "integration" && session && (
            <SessionIntegration
              session={{
                id: session.id,
                title: session.title,
                active_topic: session.active_topic,
                active_belief: session.active_belief,
                active_column: session.active_column,
                emotional_current: session.emotional_current,
                patterns: (session.patterns as string[] | null) ?? [],
              }}
              lastInsight={lastAssistant?.content?.slice(0, 400)}
            />
          )}
        </div>

        {/* Composer */}
        <form
          onSubmit={sendMessage}
          className="z-20 shrink-0 border-t bg-background/95 px-3 py-3 backdrop-blur md:px-5 md:py-3 pb-[max(env(safe-area-inset-bottom),0.75rem)]"
        >
          <div className="max-w-3xl mx-auto">
            <div className="flex items-end rounded-[1.5rem] border bg-card p-1.5 shadow-sm transition-all focus-within:border-primary/50 focus-within:ring-4 focus-within:ring-primary/5">
              <button
                type="button"
                onClick={recording ? stopRecording : startRecording}
                disabled={streaming || transcribing}
                className={cn(
                  "h-11 w-11 rounded-full flex items-center justify-center shrink-0 transition-all",
                  recording
                    ? "bg-destructive text-destructive-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-primary",
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

              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Pasakyk, kas dabar kyla mintyse…"
                rows={1}
                disabled={streaming || transcribing}
                className="max-h-32 min-h-[42px] flex-1 resize-none border-0 bg-transparent px-2 py-2 text-base shadow-none focus-visible:ring-0"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
              />
              <Button
                type="submit"
                size="icon"
                disabled={streaming || !input.trim()}
                className="h-11 w-11 shrink-0 rounded-full bg-gradient-to-br from-primary to-map-violet p-0 shadow-md hover:opacity-90"
              >
                {streaming ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </form>
      </div>

      {/* Right panel — desktop */}
      {mode === "goal_clarify" ? <GoalClarifier data={goalData} onSave={saveGoal} /> : null}

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
            grid,
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

function modeLabel(mode: SessionMode) {
  if (mode === "goal_clarify") return "Tikslo išgryninimas";
  if (mode === "mentor") return "Mentorius";
  return "Emocinis balansas";
}

function MessageBubble({ message }: { message: Message }) {
  const time = message.created_at
    ? new Date(message.created_at).toLocaleTimeString("lt-LT", {
        hour: "2-digit",
        minute: "2-digit",
      })
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
