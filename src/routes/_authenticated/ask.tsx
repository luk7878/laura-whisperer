import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useRef, useState, type FormEvent } from "react";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  MessageSquare, Send, Loader2, Library, Target, ListChecks,
  BookOpen, Sparkles, User as UserIcon,
} from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { extractActionsPayload, type ActionSuggestion } from "@/lib/parse-actions-payload";

export const Route = createFileRoute("/_authenticated/ask")({
  component: AskPage,
});

type Source = { n: number; title: string };
type Msg = {
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  actions?: ActionSuggestion[];
};

const STARTERS = [
  "Kaip teisingai suformuluoti tikslą?",
  "Kas yra vertybės ir kaip jas atrasti?",
  "Kaip parašyti stiprią afirmaciją?",
  "Padėk susidėlioti planą per 7 gyvenimo sritis",
];

function AskPage() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [action, setAction] = useState<ActionSuggestion | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  async function send(textOverride?: string, e?: FormEvent) {
    e?.preventDefault();
    const text = (textOverride ?? input).trim();
    if (!text || busy) return;
    const next: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) throw new Error("Nesi prisijungęs");
      const resp = await fetch("/api/mentor-chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          messages: next.map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      if (!resp.ok || !resp.body) throw new Error(await resp.text().catch(() => "AI klaida"));

      // Read source titles header for pretty rendering
      let sources: Source[] = [];
      const srcHeader = resp.headers.get("X-Sources-Json");
      if (srcHeader) {
        try {
          const parsed = JSON.parse(srcHeader) as { title: string }[];
          sources = parsed.map((s, i) => ({ n: i + 1, title: s.title }));
        } catch { /* ignore */ }
      }

      setMessages((m) => [...m, { role: "assistant", content: "", sources }]);
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let full = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        full += decoder.decode(value, { stream: true });
        const { clean } = extractActionsPayload(full);
        setMessages((m) => {
          const c = [...m];
          c[c.length - 1] = { ...c[c.length - 1], content: clean };
          return c;
        });
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
      }
      const { clean, actions } = extractActionsPayload(full);
      setMessages((m) => {
        const c = [...m];
        c[c.length - 1] = { ...c[c.length - 1], content: clean, actions };
        return c;
      });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Klaida");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-gradient-to-b from-background to-muted/30">
      <header className="border-b bg-background/80 backdrop-blur px-6 py-4 flex items-start gap-3">
        <SidebarTrigger className="mt-1" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <MessageSquare className="h-5 w-5" />
            </div>
            <div>
              <h1 className="font-serif text-2xl leading-tight">Klausk mentoriaus</h1>
              <p className="text-xs text-muted-foreground">
                Atsakymai iš tavo įkeltos medžiagos. Trumpai, aiškiai, be vandens.
              </p>
            </div>
          </div>
        </div>
        <Button asChild variant="outline" size="sm" className="gap-2">
          <Link to="/knowledge">
            <Library className="h-3.5 w-3.5" /> Žinių bazė
          </Link>
        </Button>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 md:px-6 py-6">
        <div className="max-w-3xl mx-auto space-y-6">
          {messages.length === 0 && (
            <Card className="p-8 bg-card/60 backdrop-blur border-dashed">
              <div className="flex items-center gap-3 mb-4">
                <Sparkles className="h-5 w-5 text-primary" />
                <h2 className="font-serif text-xl">Kuo galiu padėti?</h2>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Klausk savo žodžiais. Jei prašai plano ar žingsnių – susidėliosiu per 7 gyvenimo sritis.
              </p>
              <div className="grid sm:grid-cols-2 gap-2">
                {STARTERS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="text-left text-sm p-3 rounded-lg border bg-background hover:bg-accent transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </Card>
          )}

          {messages.map((m, i) => (
            <MessageBubble key={i} msg={m} onAction={setAction} />
          ))}
          {busy && messages[messages.length - 1]?.role === "user" && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground pl-11">
              <Loader2 className="h-4 w-4 animate-spin" />
              Mentorius rašo…
            </div>
          )}
        </div>
      </div>

      <form
        onSubmit={(e) => send(undefined, e)}
        className="border-t bg-background/95 backdrop-blur p-4"
      >
        <div className="max-w-3xl mx-auto flex gap-2 items-end">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Užduok klausimą savo žinių bazei…"
            rows={2}
            className="resize-none rounded-2xl bg-muted/50 border-muted"
          />
          <Button
            type="submit"
            size="icon"
            disabled={busy || !input.trim()}
            className="rounded-full h-11 w-11 shrink-0"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </form>

      <SaveActionDialog action={action} onClose={() => setAction(null)} />
    </div>
  );
}

function MessageBubble({ msg, onAction }: { msg: Msg; onAction: (a: ActionSuggestion) => void }) {
  const isUser = msg.role === "user";
  return (
    <div className={cn("flex gap-3", isUser && "flex-row-reverse")}>
      <div
        className={cn(
          "h-8 w-8 rounded-full flex items-center justify-center shrink-0 mt-0.5",
          isUser ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary",
        )}
      >
        {isUser ? <UserIcon className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
      </div>
      <div className={cn("flex-1 min-w-0 space-y-2", isUser && "flex flex-col items-end")}>
        <div
          className={cn(
            "rounded-2xl px-4 py-3 max-w-[92%] text-sm",
            isUser
              ? "bg-primary text-primary-foreground rounded-tr-sm"
              : "bg-card border rounded-tl-sm shadow-sm",
          )}
        >
          {isUser ? (
            <div className="whitespace-pre-wrap">{msg.content}</div>
          ) : msg.content ? (
            <div className="prose prose-sm dark:prose-invert max-w-none prose-headings:font-serif prose-headings:mt-4 prose-headings:mb-2 prose-p:my-2 prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5">
              <ReactMarkdown>{msg.content}</ReactMarkdown>
            </div>
          ) : (
            <Loader2 className="h-4 w-4 animate-spin" />
          )}
        </div>

        {!isUser && msg.actions && msg.actions.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {msg.actions.map((a, i) => (
              <Button
                key={i}
                size="sm"
                variant="outline"
                className="gap-1.5 h-8 text-xs"
                onClick={() => onAction(a)}
              >
                {a.kind === "goal" ? (
                  <Target className="h-3.5 w-3.5 text-primary" />
                ) : (
                  <ListChecks className="h-3.5 w-3.5 text-primary" />
                )}
                {a.kind === "goal" ? "→ Tikslas" : "→ Prioritetas"}: {a.title}
              </Button>
            ))}
          </div>
        )}

        {!isUser && msg.sources && msg.sources.length > 0 && (
          <div className="flex flex-wrap gap-1.5 items-center">
            <BookOpen className="h-3 w-3 text-muted-foreground" />
            {msg.sources.map((s) => (
              <Badge
                key={s.n}
                variant="secondary"
                className="text-[10px] font-normal"
                title={s.title}
              >
                {s.title.length > 32 ? s.title.slice(0, 30) + "…" : s.title}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SaveActionDialog({
  action,
  onClose,
}: {
  action: ActionSuggestion | null;
  onClose: () => void;
}) {
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [date, setDate] = useState("");
  const [saving, setSaving] = useState(false);

  useMemo(() => {
    if (action) {
      setTitle(action.title);
      setDesc(action.description ?? "");
      if (action.due_in_days) {
        const d = new Date();
        d.setDate(d.getDate() + action.due_in_days);
        setDate(d.toISOString().slice(0, 10));
      } else {
        setDate("");
      }
    }
  }, [action]);

  if (!action) return null;
  const isGoal = action.kind === "goal";

  async function save() {
    if (!title.trim() || !action) return;
    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) { setSaving(false); return; }
    const { error } = isGoal
      ? await supabase.from("goals").insert({
          user_id: userData.user.id,
          title: title.trim(),
          description: desc.trim() || null,
          target_date: date || null,
          status: "active",
          progress: 0,
        })
      : await supabase.from("priorities").insert({
          user_id: userData.user.id,
          title: title.trim(),
          due_date: date || null,
        });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(isGoal ? "Tikslas išsaugotas" : "Prioritetas išsaugotas");
    onClose();
  }

  return (
    <Dialog open={!!action} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl flex items-center gap-2">
            {isGoal ? <Target className="h-5 w-5 text-primary" /> : <ListChecks className="h-5 w-5 text-primary" />}
            {isGoal ? "Įrašyti tikslą" : "Įtraukti į prioritetus"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Pavadinimas</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1.5" />
          </div>
          {isGoal && (
            <div>
              <Label>Aprašymas</Label>
              <Textarea
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                rows={3}
                className="mt-1.5"
              />
            </div>
          )}
          <div>
            <Label>{isGoal ? "Terminas (data)" : "Iki kada"}</Label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1.5 w-52"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Atšaukti</Button>
          <Button onClick={save} disabled={saving || !title.trim()}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Išsaugoti"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
