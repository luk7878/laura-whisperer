import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { Plus, LogOut, Mic, MicOff, Send, Sparkles, Loader2, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

type Session = { id: string; title: string; updated_at: string };
type Message = { id: string; role: "user" | "assistant"; content: string };

function Dashboard() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    loadSessions();
  }, []);

  useEffect(() => {
    if (activeId) loadMessages(activeId);
    else setMessages([]);
  }, [activeId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, streaming]);

  useEffect(() => {
    textareaRef.current?.focus();
  }, [activeId, streaming]);

  async function loadSessions() {
    const { data, error } = await supabase
      .from("sessions")
      .select("id, title, updated_at")
      .order("updated_at", { ascending: false });
    if (error) return toast.error(error.message);
    setSessions(data ?? []);
    if (!activeId && data && data.length > 0) setActiveId(data[0].id);
  }

  async function loadMessages(sid: string) {
    const { data, error } = await supabase
      .from("messages")
      .select("id, role, content")
      .eq("session_id", sid)
      .order("created_at", { ascending: true });
    if (error) return toast.error(error.message);
    setMessages((data ?? []) as Message[]);
  }

  async function newSession() {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    const { data, error } = await supabase
      .from("sessions")
      .insert({ user_id: userData.user.id, title: "Nauja sesija" })
      .select("id, title, updated_at")
      .single();
    if (error) return toast.error(error.message);
    setSessions((s) => [data as Session, ...s]);
    setActiveId(data.id);
    setMessages([]);
  }

  async function deleteSession(id: string) {
    const { error } = await supabase.from("sessions").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setSessions((s) => s.filter((x) => x.id !== id));
    if (activeId === id) setActiveId(null);
  }

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  }

  async function ensureSession(): Promise<string | null> {
    if (activeId) return activeId;
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return null;
    const { data, error } = await supabase
      .from("sessions")
      .insert({ user_id: userData.user.id, title: "Nauja sesija" })
      .select("id, title, updated_at")
      .single();
    if (error) {
      toast.error(error.message);
      return null;
    }
    setSessions((s) => [data as Session, ...s]);
    setActiveId(data.id);
    return data.id;
  }

  async function sendMessage(e?: FormEvent) {
    e?.preventDefault();
    const text = input.trim();
    if (!text || streaming) return;

    const sid = await ensureSession();
    if (!sid) return;

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    // Optimistic user message
    const userMsg: Message = { id: `tmp-${Date.now()}`, role: "user", content: text };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setStreaming(true);

    // Persist user message
    await supabase.from("messages").insert({
      session_id: sid,
      user_id: userData.user.id,
      role: "user",
      content: text,
    });

    // Auto-title from first user message
    if (messages.length === 0) {
      const title = text.slice(0, 60);
      await supabase.from("sessions").update({ title }).eq("id", sid);
      setSessions((s) => s.map((x) => (x.id === sid ? { ...x, title } : x)));
    }

    // Stream AI
    const history = [...messages, userMsg].map((m) => ({ role: m.role, content: m.content }));
    const assistantId = `tmp-a-${Date.now()}`;
    setMessages((m) => [...m, { id: assistantId, role: "assistant", content: "" }]);

    try {
      const resp = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history }),
      });
      if (!resp.ok || !resp.body) {
        throw new Error(await resp.text().catch(() => "AI klaida"));
      }
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let full = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        full += chunk;
        setMessages((m) =>
          m.map((x) => (x.id === assistantId ? { ...x, content: full } : x)),
        );
      }
      await supabase.from("messages").insert({
        session_id: sid,
        user_id: userData.user.id,
        role: "assistant",
        content: full,
      });
    } catch (err: any) {
      toast.error(err.message ?? "AI klaida");
      setMessages((m) => m.filter((x) => x.id !== assistantId));
    } finally {
      setStreaming(false);
    }
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "audio/mp4";
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
          fd.append("file", blob, `recording.${mime.includes("webm") ? "webm" : "mp4"}`);
          const resp = await fetch("/api/transcribe", { method: "POST", body: fd });
          if (!resp.ok) throw new Error(await resp.text());
          const { text } = await resp.json();
          setInput((prev) => (prev ? prev + " " + text : text));
        } catch (err: any) {
          toast.error(err.message ?? "Transkripcijos klaida");
        } finally {
          setTranscribing(false);
        }
      };
      rec.start();
      recorderRef.current = rec;
      setRecording(true);
    } catch (err: any) {
      toast.error(err.message ?? "Nepavyko pasiekti mikrofono");
    }
  }

  function stopRecording() {
    recorderRef.current?.stop();
    recorderRef.current = null;
    setRecording(false);
  }

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <aside className="w-72 border-r bg-card/50 flex flex-col">
        <div className="p-4 border-b flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <span className="font-semibold text-sm">Demartini Coach AI</span>
        </div>
        <div className="p-3">
          <Button onClick={newSession} className="w-full gap-2" size="sm">
            <Plus className="h-4 w-4" /> Nauja sesija
          </Button>
        </div>
        <ScrollArea className="flex-1 px-2">
          <div className="space-y-1 pb-2">
            {sessions.map((s) => (
              <div
                key={s.id}
                className={cn(
                  "group flex items-center gap-1 rounded-md px-2 py-1.5 text-sm cursor-pointer hover:bg-accent",
                  activeId === s.id && "bg-accent",
                )}
                onClick={() => setActiveId(s.id)}
              >
                <span className="flex-1 truncate">{s.title}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm("Ištrinti sesiją?")) deleteSession(s.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            {sessions.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-8 px-4">
                Sesijų dar nėra. Sukurkite naują.
              </p>
            )}
          </div>
        </ScrollArea>
        <div className="p-3 border-t">
          <Button variant="ghost" size="sm" className="w-full gap-2" onClick={signOut}>
            <LogOut className="h-4 w-4" /> Atsijungti
          </Button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col">
        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl px-6 py-8 space-y-6">
            {messages.length === 0 && (
              <Card className="p-8 text-center border-dashed">
                <Sparkles className="h-8 w-8 text-primary mx-auto mb-3" />
                <h2 className="font-semibold text-lg">Įveskite kliento pasisakymą</h2>
                <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
                  Įrašykite balsu arba parašykite, ką klientas pasakė. Asistentas
                  atliks emocinę analizę, parinks Formą A/B, stulpelį ir pasiūlys 3
                  galingus klausimus.
                </p>
              </Card>
            )}
            {messages.map((m) => (
              <div
                key={m.id}
                className={cn(
                  "rounded-lg p-4",
                  m.role === "user"
                    ? "bg-primary/10 border border-primary/20 ml-8"
                    : "bg-card border mr-8",
                )}
              >
                <div className="text-xs font-medium uppercase tracking-wide mb-2 text-muted-foreground">
                  {m.role === "user" ? "Kliento pasisakymas" : "AI analizė"}
                </div>
                {m.role === "assistant" ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <ReactMarkdown>{m.content || "…"}</ReactMarkdown>
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap text-sm">{m.content}</p>
                )}
              </div>
            ))}
            {streaming && messages[messages.length - 1]?.role !== "assistant" && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Analizuoju…
              </div>
            )}
          </div>
        </div>

        <form onSubmit={sendMessage} className="border-t bg-card/50 p-4">
          <div className="mx-auto max-w-3xl">
            <div className="flex gap-2 items-end">
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder='pvz. „Aš tiesiog žaviuosi savo šefu, jis toks tobulas..."'
                rows={3}
                disabled={streaming || transcribing}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    sendMessage();
                  }
                }}
              />
              <div className="flex flex-col gap-2">
                <Button
                  type="button"
                  size="icon"
                  variant={recording ? "destructive" : "outline"}
                  onClick={recording ? stopRecording : startRecording}
                  disabled={streaming || transcribing}
                  title={recording ? "Sustabdyti įrašymą" : "Įrašyti balsu"}
                >
                  {transcribing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : recording ? (
                    <MicOff className="h-4 w-4" />
                  ) : (
                    <Mic className="h-4 w-4" />
                  )}
                </Button>
                <Button type="submit" size="icon" disabled={streaming || !input.trim()}>
                  {streaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Ctrl/⌘ + Enter — siųsti. Įrašymo klavišas – balso į tekstą.
            </p>
          </div>
        </form>
      </main>
    </div>
  );
}
