import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { MessageSquare, Send, Loader2, Library } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/ask")({
  component: AskPage,
});

type Msg = { role: "user" | "assistant"; content: string };

function AskPage() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  async function send(e?: FormEvent) {
    e?.preventDefault();
    const text = input.trim();
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
        body: JSON.stringify({ messages: next }),
      });
      if (!resp.ok || !resp.body) throw new Error(await resp.text().catch(() => "AI klaida"));
      setMessages((m) => [...m, { role: "assistant", content: "" }]);
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let full = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        full += decoder.decode(value, { stream: true });
        setMessages((m) => {
          const c = [...m];
          c[c.length - 1] = { role: "assistant", content: full };
          return c;
        });
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Klaida");
      setMessages((m) => m.filter((_, i) => i !== m.length - 1 || m[i].role !== "assistant" || m[i].content));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <header className="border-b bg-background/80 backdrop-blur px-6 py-4 flex items-start gap-3">
        <SidebarTrigger className="mt-1" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <MessageSquare className="h-6 w-6 text-primary" />
            <h1 className="font-serif text-3xl leading-tight">Klausk mentoriaus</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Greitas Q&amp;A iš tavo įkeltos medžiagos. Atsakymai su citatomis.
          </p>
        </div>
        <Button asChild variant="outline" size="sm" className="gap-2">
          <Link to="/knowledge">
            <Library className="h-3.5 w-3.5" /> Žinių bazė
          </Link>
        </Button>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-3xl mx-auto space-y-4">
          {messages.length === 0 && (
            <Card className="p-6 text-center text-sm text-muted-foreground">
              Užduok klausimą, pvz. „Kaip Demartini apibrėžia vertybes?" arba „Kaip teisingai nusistatyti tikslą?"
            </Card>
          )}
          {messages.map((m, i) => (
            <div
              key={i}
              className={cn(
                "rounded-xl p-4 whitespace-pre-wrap text-sm",
                m.role === "user"
                  ? "bg-primary/10 border border-primary/20 ml-8"
                  : "bg-card border mr-8",
              )}
            >
              {m.content || <Loader2 className="h-4 w-4 animate-spin" />}
            </div>
          ))}
        </div>
      </div>

      <form onSubmit={send} className="border-t bg-background p-4">
        <div className="max-w-3xl mx-auto flex gap-2">
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
            className="resize-none"
          />
          <Button type="submit" disabled={busy || !input.trim()} className="gap-2">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </form>
    </div>
  );
}
