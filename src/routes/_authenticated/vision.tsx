import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Eye, Save, Loader2, Sparkles, Check } from "lucide-react";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/vision")({
  component: VisionPage,
});

type VisionRow = {
  id: string;
  horizon_years: number;
  content: string | null;
  updated_at: string;
};

const HORIZONS = [
  {
    years: 5,
    title: "5 metai",
    subtitle: "Artimiausia kryptis",
    prompt:
      "Kur nori būti po 5 metų? Kokie tikslai, aplinka, santykiai, kasdienybė?",
    accent: "bg-map-teal/10 text-map-teal border-map-teal/30",
  },
  {
    years: 10,
    title: "10 metų",
    subtitle: "Vidutinė perspektyva",
    prompt: "Koks tavo gyvenimas po 10 metų? Kokią įtaką kuri, ką jau pasiekei?",
    accent: "bg-primary/10 text-primary border-primary/30",
  },
  {
    years: 20,
    title: "20 metų",
    subtitle: "Ilgalaikė vizija",
    prompt:
      "Koks tavo palikimas po 20 metų? Kas svarbiausia tavo gyvenimo istorijai?",
    accent: "bg-map-orange/10 text-map-orange border-map-orange/30",
  },
] as const;

function VisionPage() {
  const [rows, setRows] = useState<Record<number, VisionRow | null>>({
    5: null,
    10: null,
    20: null,
  });
  const [drafts, setDrafts] = useState<Record<number, string>>({ 5: "", 10: "", 20: "" });
  const [saving, setSaving] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("vision")
        .select("id, horizon_years, content, updated_at")
        .order("horizon_years");
      const next: Record<number, VisionRow | null> = { 5: null, 10: null, 20: null };
      const nextDraft: Record<number, string> = { 5: "", 10: "", 20: "" };
      for (const r of (data as VisionRow[]) ?? []) {
        next[r.horizon_years] = r;
        nextDraft[r.horizon_years] = r.content ?? "";
      }
      setRows(next);
      setDrafts(nextDraft);
      setLoading(false);
    })();
  }, []);

  async function save(years: number) {
    setSaving(years);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return setSaving(null);
    const existing = rows[years];
    const content = drafts[years].trim();
    let error;
    if (existing) {
      ({ error } = await supabase
        .from("vision")
        .update({ content, updated_at: new Date().toISOString() })
        .eq("id", existing.id));
    } else {
      const { error: insErr, data: ins } = await supabase
        .from("vision")
        .insert({ user_id: userData.user.id, horizon_years: years, content })
        .select("id, horizon_years, content, updated_at")
        .single();
      error = insErr;
      if (ins) setRows((r) => ({ ...r, [years]: ins as VisionRow }));
    }
    setSaving(null);
    if (error) return toast.error(error.message);
    toast.success("Išsaugota");
    if (existing)
      setRows((r) => ({
        ...r,
        [years]: { ...existing, content, updated_at: new Date().toISOString() },
      }));
  }

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <header className="border-b bg-background/80 backdrop-blur px-3 md:px-6 py-3 md:py-4 flex items-center gap-2 md:gap-3">
        <SidebarTrigger className="shrink-0" />
        <div className="flex-1 min-w-0">
          <h1 className="font-serif text-xl md:text-2xl leading-tight">Vizija</h1>
          <p className="text-xs md:text-sm text-muted-foreground hidden sm:block truncate">
            Trys horizontai — trys tavo augimo kryptys.
          </p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-3 md:p-6 bg-muted/20">
        <div className="max-w-5xl mx-auto space-y-4">
          {loading && <div className="text-sm text-muted-foreground">Kraunama…</div>}
          {!loading && (
            <div className="grid gap-4 md:grid-cols-3">
              {HORIZONS.map((h) => {
                const row = rows[h.years];
                const draft = drafts[h.years];
                const dirty = (row?.content ?? "") !== draft;
                return (
                  <Card key={h.years} className="p-4 md:p-5 flex flex-col">
                    <div className="flex items-start gap-3 mb-3">
                      <div className={`h-10 w-10 rounded-xl border flex items-center justify-center shrink-0 ${h.accent}`}>
                        <Eye className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h2 className="font-serif text-xl">{h.title}</h2>
                          {row?.content && (
                            <Badge variant="outline" className="text-[10px] gap-1">
                              <Check className="h-3 w-3" /> Užpildyta
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">{h.subtitle}</p>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground italic mb-2">{h.prompt}</p>
                    <Textarea
                      value={draft}
                      onChange={(e) =>
                        setDrafts((d) => ({ ...d, [h.years]: e.target.value }))
                      }
                      rows={8}
                      placeholder="Rašyk laisvai — vėliau AI padės sustruktūrinti…"
                      className="flex-1 resize-none min-h-[160px]"
                    />
                    <div className="flex items-center gap-2 mt-3">
                      <Button
                        size="sm"
                        onClick={() => save(h.years)}
                        disabled={!dirty || saving === h.years}
                        className="gap-1.5"
                      >
                        {saving === h.years ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Save className="h-3.5 w-3.5" />
                        )}
                        Išsaugoti
                      </Button>
                      <Button asChild size="sm" variant="outline" className="gap-1.5">
                        <Link to="/ask">
                          <Sparkles className="h-3.5 w-3.5" />
                          Aptarti su AI
                        </Link>
                      </Button>
                    </div>
                    {row?.updated_at && (
                      <div className="text-[10px] text-muted-foreground mt-2">
                        Atnaujinta {new Date(row.updated_at).toLocaleDateString("lt-LT")}
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
