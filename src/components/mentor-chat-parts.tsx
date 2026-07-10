import { useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  ChevronDown,
  FileText,
  Loader2,
  Target,
  ListChecks,
  BookOpen,
  Sparkles,
  User as UserIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import type { ActionSuggestion } from "@/lib/parse-actions-payload";

export type Source = { n: number; title: string; excerpt?: string; similarity?: number };
export type Msg = {
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  actions?: ActionSuggestion[];
};

export function MessageBubble({
  msg,
  onAction,
}: {
  msg: Msg;
  onAction: (a: ActionSuggestion) => void;
}) {
  const isUser = msg.role === "user";
  return (
    <div className={cn("flex gap-2 md:gap-3", isUser && "flex-row-reverse")}>
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
            "rounded-2xl px-4 md:px-5 py-3 md:py-4 text-sm break-words",
            isUser
              ? "bg-primary text-primary-foreground rounded-tr-sm max-w-[85%]"
              : "bg-card border border-border/70 rounded-tl-sm shadow-sm w-full",
          )}
        >
          {isUser ? (
            <div className="whitespace-pre-wrap">{msg.content}</div>
          ) : msg.content ? (
            <div className="prose prose-sm dark:prose-invert max-w-none leading-relaxed prose-headings:font-serif prose-headings:text-foreground prose-headings:mt-5 prose-headings:mb-2 prose-p:my-2.5 prose-ul:my-2.5 prose-ol:my-2.5 prose-li:my-1 prose-strong:text-foreground">
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
                className="gap-1.5 h-8 text-xs max-w-full"
                onClick={() => onAction(a)}
              >
                {a.kind === "goal" ? (
                  <Target className="h-3.5 w-3.5 text-primary shrink-0" />
                ) : (
                  <ListChecks className="h-3.5 w-3.5 text-primary shrink-0" />
                )}
                <span className="truncate">
                  {a.kind === "goal" ? "→ Tikslas" : "→ Prioritetas"}: {a.title}
                </span>
              </Button>
            ))}
          </div>
        )}

        {!isUser && msg.sources && msg.sources.length > 0 && <SourcesPanel sources={msg.sources} />}
      </div>
    </div>
  );
}

function SourcesPanel({ sources }: { sources: Source[] }) {
  return (
    <details className="group w-full rounded-xl border bg-muted/25 text-xs">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 text-muted-foreground hover:text-foreground">
        <BookOpen className="h-3.5 w-3.5 text-primary" />
        <span className="font-medium">Kuo rėmėsi atsakymas</span>
        <Badge variant="secondary" className="ml-1 h-5 text-[10px]">
          {sources.length}
        </Badge>
        <ChevronDown className="ml-auto h-3.5 w-3.5 transition-transform group-open:rotate-180" />
      </summary>
      <div className="space-y-2 border-t p-2.5">
        {sources.map((source) => (
          <div key={source.n} className="rounded-lg border bg-background p-3">
            <div className="flex items-start gap-2">
              <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="truncate font-medium">{source.title}</div>
                  {source.similarity != null && (
                    <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] text-primary">
                      {source.similarity}% atitikimas
                    </span>
                  )}
                </div>
                {source.excerpt && (
                  <p className="mt-2 whitespace-pre-wrap leading-relaxed text-muted-foreground">
                    {source.excerpt}
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </details>
  );
}

export function SaveActionDialog({
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
      } else setDate("");
    }
  }, [action]);

  if (!action) return null;
  const isGoal = action.kind === "goal";

  async function save() {
    if (!title.trim() || !action) return;
    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setSaving(false);
      return;
    }
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
            {isGoal ? (
              <Target className="h-5 w-5 text-primary" />
            ) : (
              <ListChecks className="h-5 w-5 text-primary" />
            )}
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
          <Button variant="ghost" onClick={onClose}>
            Atšaukti
          </Button>
          <Button onClick={save} disabled={saving || !title.trim()}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Išsaugoti"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export async function streamMentorReply({
  messages,
  onDelta,
}: {
  messages: { role: "user" | "assistant"; content: string }[];
  onDelta: (fullText: string) => void;
}): Promise<{ full: string; sources: Source[] }> {
  const { data: sess } = await supabase.auth.getSession();
  const token = sess.session?.access_token;
  if (!token) throw new Error("Nesi prisijungęs");
  const resp = await fetch("/api/mentor-chat", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ messages }),
  });
  if (!resp.ok || !resp.body) throw new Error(await resp.text().catch(() => "AI klaida"));
  let sources: Source[] = [];
  const srcHeader = resp.headers.get("X-Sources-B64");
  if (srcHeader) {
    try {
      const json = decodeURIComponent(escape(atob(srcHeader)));
      const parsed = JSON.parse(json) as Omit<Source, "n">[];
      sources = parsed.map((s, i) => ({ n: i + 1, ...s }));
    } catch {
      /* ignore */
    }
  }
  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let full = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    full += decoder.decode(value, { stream: true });
    onDelta(full);
  }
  return { full, sources };
}
