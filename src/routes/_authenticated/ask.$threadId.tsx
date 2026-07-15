import { createFileRoute, useParams } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { extractActionsPayload, type ActionSuggestion } from "@/lib/parse-actions-payload";
import {
  MessageBubble,
  SaveActionDialog,
  streamMentorReply,
  type Msg,
  type Source,
} from "@/components/mentor-chat-parts";

export const Route = createFileRoute("/_authenticated/ask/$threadId")({
  component: ThreadView,
});

type Row = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources: unknown;
  created_at: string;
};

function actionKey(action: ActionSuggestion) {
  return `${action.kind}:${action.title}`;
}

function isConfirmationMessage(value: string) {
  return /^(taip[,!]?\s*)?((prašau|prasau)\s+)?(patvirtinu|patvirtink|išsaugok|issaugok|pridėk|pridek)(\s*(viską|viska|juos|jas))?[.!]?$/i.test(
    value.trim(),
  );
}

function ThreadView() {
  const { threadId } = useParams({ from: "/_authenticated/ask/$threadId" });
  const [messages, setMessages] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [input, setInput] = useState("");
  const [action, setAction] = useState<ActionSuggestion | null>(null);
  const [savedActionKeys, setSavedActionKeys] = useState<Set<string>>(new Set());
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const autoRepliedFor = useRef<string | null>(null);
  const assistantRunningRef = useRef(false);

  // Load messages when thread changes
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setMessages([]);
    setSavedActionKeys(new Set());
    autoRepliedFor.current = null;
    (async () => {
      const { data, error } = await supabase
        .from("mentor_messages")
        .select("id,role,content,sources,created_at")
        .eq("thread_id", threadId)
        .order("created_at", { ascending: true });
      if (cancelled) return;
      if (error) {
        toast.error(error.message);
        setLoading(false);
        return;
      }
      const rows = (data ?? []) as Row[];
      const msgs: Msg[] = rows.map((r) => {
        const srcArr = Array.isArray(r.sources) ? (r.sources as Omit<Source, "n">[]) : [];
        const sources: Source[] = srcArr.map((s, i) => ({ n: i + 1, ...s }));
        const { clean, actions } =
          r.role === "assistant"
            ? extractActionsPayload(r.content)
            : { clean: r.content, actions: [] as ActionSuggestion[] };
        return {
          role: r.role,
          content: clean,
          sources: sources.length ? sources : undefined,
          actions,
        };
      });
      setMessages(msgs);
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    })();
    return () => {
      cancelled = true;
    };
  }, [threadId]);

  // Auto-reply when last message is user with no assistant follow-up (e.g. thread just created)
  useEffect(() => {
    if (loading || busy) return;
    if (messages.length === 0) return;
    const last = messages[messages.length - 1];
    if (last.role !== "user") return;
    if (autoRepliedFor.current === threadId) return;
    autoRepliedFor.current = threadId;
    void runAssistant(messages);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, messages, threadId]);

  async function runAssistant(current: Msg[]) {
    if (assistantRunningRef.current) return;
    assistantRunningRef.current = true;
    setBusy(true);
    setMessages((m) => [...m, { role: "assistant", content: "" }]);
    try {
      const { full, sources } = await streamMentorReply({
        messages: current.map((m) => ({ role: m.role, content: m.content })),
        onDelta: (buf) => {
          const { clean } = extractActionsPayload(buf);
          setMessages((m) => {
            const c = [...m];
            c[c.length - 1] = { ...c[c.length - 1], content: clean };
            return c;
          });
          scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
        },
      });
      const { clean, actions } = extractActionsPayload(full);
      setMessages((m) => {
        const c = [...m];
        c[c.length - 1] = { ...c[c.length - 1], content: clean, actions, sources };
        return c;
      });
      // Persist assistant message (store raw so actions survive reload)
      const { data: userData } = await supabase.auth.getUser();
      if (userData.user) {
        await supabase.from("mentor_messages").insert({
          thread_id: threadId,
          user_id: userData.user.id,
          role: "assistant",
          content: full,
          sources: sources.map((source) => ({
            title: source.title,
            excerpt: source.excerpt,
            similarity: source.similarity,
          })),
        });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "AI klaida");
      setMessages((m) => m.slice(0, -1));
    } finally {
      assistantRunningRef.current = false;
      setBusy(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  async function send(e?: FormEvent) {
    e?.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return toast.error("Nesi prisijungęs");
    const next: Msg[] = [...messages, { role: "user", content: text }];
    // Šią žinutę apdoros send() srautas. Neleisk pradinės gijos auto-reply efektui
    // tuo pačiu metu paleisti antros identiškos AI užklausos.
    autoRepliedFor.current = threadId;
    setMessages(next);
    const { error } = await supabase.from("mentor_messages").insert({
      thread_id: threadId,
      user_id: userData.user.id,
      role: "user",
      content: text,
    });
    if (error) return toast.error(error.message);
    const pendingActions = [...messages]
      .reverse()
      .find((message) => message.role === "assistant" && message.actions?.length)
      ?.actions?.filter((suggestion) => !savedActionKeys.has(actionKey(suggestion)));
    if (isConfirmationMessage(text) && pendingActions?.length) {
      await confirmActionsFromChat(next, pendingActions);
      return;
    }
    await runAssistant(next);
  }

  async function confirmActionsFromChat(current: Msg[], suggestions: ActionSuggestion[]) {
    setBusy(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Nesi prisijungęs");
      const uid = userData.user.id;
      const goals = suggestions.filter((suggestion) => suggestion.kind === "goal");
      const priorities = suggestions.filter((suggestion) => suggestion.kind !== "goal");
      const toDate = (days?: number) => {
        if (days == null) return null;
        const date = new Date();
        date.setDate(date.getDate() + days);
        return date.toISOString().slice(0, 10);
      };
      if (goals.length) {
        const { error } = await supabase.from("goals").insert(
          goals.map((goal) => ({
            user_id: uid,
            title: goal.title.trim(),
            description: goal.description?.trim() || null,
            target_date: toDate(goal.due_in_days),
            status: "active",
            progress: 0,
          })),
        );
        if (error) throw error;
      }
      if (priorities.length) {
        const { error } = await supabase.from("priorities").insert(
          priorities.map((priority) => ({
            user_id: uid,
            title: priority.title.trim(),
            due_date: toDate(priority.due_in_days),
          })),
        );
        if (error) throw error;
      }
      const confirmation = [
        "Patvirtinta ir išsaugota sistemoje:",
        ...suggestions.map(
          (suggestion) =>
            `- ${suggestion.kind === "goal" ? "Tikslai" : "Prioritetai"} → ${suggestion.title}`,
        ),
        "",
        `Rasi ${goals.length && priorities.length ? "Tikslų ir Prioritetų skiltyse" : goals.length ? "Tikslų skiltyje" : "Prioritetų skiltyje"}.`,
      ].join("\n");
      await supabase.from("mentor_messages").insert({
        thread_id: threadId,
        user_id: uid,
        role: "assistant",
        content: confirmation,
      });
      setSavedActionKeys((keys) => {
        const updated = new Set(keys);
        suggestions.forEach((suggestion) => updated.add(actionKey(suggestion)));
        return updated;
      });
      setMessages([...current, { role: "assistant", content: confirmation }]);
      toast.success("Veiksmai išsaugoti sistemoje");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nepavyko išsaugoti veiksmų");
    } finally {
      setBusy(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 md:px-6 py-4 md:py-6">
        <div className="max-w-3xl mx-auto space-y-5">
          {loading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Kraunama…
            </div>
          )}
          {messages.map((m, i) => (
            <MessageBubble key={i} msg={m} onAction={setAction} savedActionKeys={savedActionKeys} />
          ))}
          {busy && messages[messages.length - 1]?.role === "user" && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground pl-11">
              <Loader2 className="h-4 w-4 animate-spin" /> Mentorius rašo…
            </div>
          )}
        </div>
      </div>

      <form
        onSubmit={send}
        className="relative z-20 shrink-0 border-t bg-background/95 px-3 py-3 backdrop-blur md:p-4 pb-[max(env(safe-area-inset-bottom),0.75rem)]"
      >
        <div className="mx-auto flex max-w-3xl items-end gap-2 rounded-2xl border bg-card p-2 shadow-sm transition focus-within:border-primary/50 focus-within:ring-4 focus-within:ring-primary/5">
          <Textarea
            ref={inputRef}
            autoFocus
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Rašyk toliau…"
            rows={2}
            className="min-h-[48px] resize-none border-0 bg-transparent px-3 py-2 text-base shadow-none focus-visible:ring-0"
          />
          <Button
            type="submit"
            size="icon"
            disabled={busy || !input.trim()}
            className="h-11 w-11 min-w-11 shrink-0 rounded-xl"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </form>

      <SaveActionDialog
        action={action}
        onClose={() => setAction(null)}
        onSaved={(savedAction) =>
          setSavedActionKeys((current) =>
            new Set(current).add(`${savedAction.kind}:${savedAction.title}`),
          )
        }
      />
    </div>
  );
}
