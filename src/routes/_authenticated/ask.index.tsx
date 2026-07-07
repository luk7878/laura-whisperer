import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Sparkles, Send, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/ask/")({
  component: AskIndex,
});

const STARTERS = [
  "Kaip teisingai suformuluoti tikslą?",
  "Kas yra vertybės ir kaip jas atrasti?",
  "Kaip parašyti stiprią afirmaciją?",
  "Padėk susidėlioti planą per 7 gyvenimo sritis",
];

function AskIndex() {
  const navigate = useNavigate();
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  async function start(text: string, e?: FormEvent) {
    e?.preventDefault();
    const q = text.trim();
    if (!q || busy) return;
    setBusy(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Nesi prisijungęs");
      const title = q.slice(0, 60);
      const { data: thread, error: tErr } = await supabase
        .from("mentor_threads")
        .insert({ user_id: userData.user.id, title })
        .select("id")
        .single();
      if (tErr || !thread) throw new Error(tErr?.message ?? "Nepavyko sukurti pokalbio");
      const { error: mErr } = await supabase.from("mentor_messages").insert({
        thread_id: thread.id,
        user_id: userData.user.id,
        role: "user",
        content: q,
      });
      if (mErr) throw new Error(mErr.message);
      navigate({ to: "/ask/$threadId", params: { threadId: thread.id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Klaida");
      setBusy(false);
    }
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="flex-1 overflow-y-auto px-4 md:px-6 py-8">
        <div className="max-w-2xl mx-auto">
          <Card className="p-8 bg-card/60 backdrop-blur border-dashed">
            <div className="flex items-center gap-3 mb-4">
              <Sparkles className="h-5 w-5 text-primary" />
              <h2 className="font-serif text-xl">Kuo galiu padėti?</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Klausk savo žodžiais. Kiekvienas pokalbis išsaugomas – galėsi grįžti bet kada.
            </p>
            <div className="grid sm:grid-cols-2 gap-2">
              {STARTERS.map((s) => (
                <button
                  key={s}
                  disabled={busy}
                  onClick={() => start(s)}
                  className="text-left text-sm p-3 rounded-lg border bg-background hover:bg-accent transition-colors disabled:opacity-50"
                >
                  {s}
                </button>
              ))}
            </div>
          </Card>
        </div>
      </div>
      <form onSubmit={(e) => start(input, e)} className="border-t bg-background/95 backdrop-blur p-4">
        <div className="max-w-2xl mx-auto flex gap-2 items-end">
          <Textarea
            ref={inputRef}
            autoFocus
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); start(input); }
            }}
            placeholder="Užduok klausimą savo žinių bazei…"
            rows={2}
            className="resize-none rounded-2xl bg-muted/50 border-muted"
          />
          <Button type="submit" size="icon" disabled={busy || !input.trim()} className="rounded-full h-11 w-11 shrink-0">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </form>
    </div>
  );
}
