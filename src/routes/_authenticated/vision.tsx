import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Check, Compass, Eye, Loader2, Save, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/vision")({ component: VisionPage });

type Category = "be" | "do" | "have";
type Horizon = "now" | "1_year" | "5_years" | "long_term";
type Item = {
  id: string;
  category: Category;
  horizon: Horizon;
  content: string;
  why: string;
  evidence: string;
  linked_value_id: string | null;
  updated_at: string;
};
type Value = { id: string; name: string; rank: number };
type ValueLink = { vision_item_id: string; value_id: string; rationale: string };
type AlignmentReflection = { observation: string; question: string };

const CATEGORIES: {
  key: Category;
  title: string;
  subtitle: string;
  prompt: string;
  accent: string;
}[] = [
  {
    key: "be",
    title: "Būti",
    subtitle: "Tapatybė ir savybės",
    prompt: "Kokiu žmogumi renkiesi būti? Kokias savybes, gebėjimus ir vertybes įkūniji?",
    accent: "bg-map-teal/10 text-map-teal border-map-teal/30",
  },
  {
    key: "do",
    title: "Daryti",
    subtitle: "Misija ir veikla",
    prompt: "Kokią prasmingą veiklą kuri? Kam ir kokią vertę suteiki savo veiksmais?",
    accent: "bg-primary/10 text-primary border-primary/30",
  },
  {
    key: "have",
    title: "Turėti",
    subtitle: "Rezultatai ir aplinka",
    prompt: "Kokius apčiuopiamus rezultatus, santykius, aplinką ir gyvenimo būdą kuri?",
    accent: "bg-map-orange/10 text-map-orange border-map-orange/30",
  },
];
const HORIZONS: { key: Horizon; label: string }[] = [
  { key: "now", label: "Dabar" },
  { key: "1_year", label: "Po 1 metų" },
  { key: "5_years", label: "Po 5 metų" },
  { key: "long_term", label: "Ilgalaikė kryptis" },
];

function VisionPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [values, setValues] = useState<Value[]>([]);
  const [horizon, setHorizon] = useState<Horizon>("long_term");
  const [drafts, setDrafts] = useState<
    Record<Category, Omit<Item, "id" | "category" | "horizon" | "updated_at">>
  >({
    be: { content: "", why: "", evidence: "", linked_value_id: null },
    do: { content: "", why: "", evidence: "", linked_value_id: null },
    have: { content: "", why: "", evidence: "", linked_value_id: null },
  });
  const [saving, setSaving] = useState<Category | null>(null);
  const [loading, setLoading] = useState(true);
  const [valueLinks, setValueLinks] = useState<ValueLink[]>([]);
  const [selectedValues, setSelectedValues] = useState<Record<Category, string[]>>({
    be: [],
    do: [],
    have: [],
  });
  const [valueRationales, setValueRationales] = useState<Record<Category, string>>({
    be: "",
    do: "",
    have: "",
  });
  const [analyzing, setAnalyzing] = useState(false);
  const [reflection, setReflection] = useState<AlignmentReflection | null>(null);

  useEffect(() => {
    (async () => {
      const [{ data: vision }, { data: valueRows }, { data: links }] = await Promise.all([
        supabase
          .from("vision_items")
          .select("id,category,horizon,content,why,evidence,linked_value_id,updated_at"),
        supabase.from("values").select("id,name,rank").lt("rank", 100).order("rank"),
        supabase.from("vision_item_values").select("vision_item_id,value_id,rationale"),
      ]);
      setItems((vision as Item[]) ?? []);
      setValues((valueRows as Value[]) ?? []);
      setValueLinks((links as ValueLink[]) ?? []);
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    const next = { ...drafts };
    for (const category of CATEGORIES) {
      const item = items.find((row) => row.category === category.key && row.horizon === horizon);
      next[category.key] = {
        content: item?.content ?? "",
        why: item?.why ?? "",
        evidence: item?.evidence ?? "",
        linked_value_id: item?.linked_value_id ?? null,
      };
    }
    setDrafts(next);
    setSelectedValues(
      Object.fromEntries(
        CATEGORIES.map((category) => {
          const item = items.find(
            (row) => row.category === category.key && row.horizon === horizon,
          );
          const linked = item
            ? valueLinks
                .filter((link) => link.vision_item_id === item.id)
                .map((link) => link.value_id)
            : [];
          return [
            category.key,
            linked.length ? linked : item?.linked_value_id ? [item.linked_value_id] : [],
          ];
        }),
      ) as Record<Category, string[]>,
    );
    setValueRationales(
      Object.fromEntries(
        CATEGORIES.map((category) => {
          const item = items.find(
            (row) => row.category === category.key && row.horizon === horizon,
          );
          const rationale = item
            ? valueLinks.find((link) => link.vision_item_id === item.id)?.rationale
            : "";
          return [category.key, rationale ?? item?.why ?? ""];
        }),
      ) as Record<Category, string>,
    );
    setReflection(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [horizon, items, valueLinks]);

  const completion = useMemo(
    () => CATEGORIES.filter((category) => drafts[category.key].content.trim()).length,
    [drafts],
  );

  async function save(category: Category) {
    setSaving(category);
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return setSaving(null);
    const draft = drafts[category];
    const linkedIds = selectedValues[category];
    const { data, error } = await supabase
      .from("vision_items")
      .upsert(
        {
          user_id: auth.user.id,
          category,
          horizon,
          ...draft,
          linked_value_id: linkedIds[0] ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,category,horizon" },
      )
      .select("id,category,horizon,content,why,evidence,linked_value_id,updated_at")
      .single();
    setSaving(null);
    if (error) return toast.error(error.message);
    const { error: deleteError } = await supabase
      .from("vision_item_values")
      .delete()
      .eq("vision_item_id", data.id);
    if (deleteError) return toast.error("Pritaikyk naujausią duomenų bazės migraciją");
    if (linkedIds.length) {
      const { error: linkError } = await supabase.from("vision_item_values").insert(
        linkedIds.map((valueId) => ({
          user_id: auth.user.id,
          vision_item_id: data.id,
          value_id: valueId,
          rationale: valueRationales[category].trim(),
        })),
      );
      if (linkError) return toast.error(linkError.message);
    }
    setValueLinks((current) => [
      ...current.filter((link) => link.vision_item_id !== data.id),
      ...linkedIds.map((valueId) => ({
        vision_item_id: data.id,
        value_id: valueId,
        rationale: valueRationales[category].trim(),
      })),
    ]);
    setItems((current) => [
      ...current.filter((item) => !(item.category === category && item.horizon === horizon)),
      data as Item,
    ]);
    toast.success("Vizijos dalis išsaugota");
  }

  async function analyzeAlignment() {
    const vision = CATEGORIES.map((category) => ({
      category: category.key,
      content: drafts[category.key].content,
      why: drafts[category.key].why,
      evidence: drafts[category.key].evidence,
    })).filter((item) => item.content.trim());
    if (!vision.length) return toast.error("Pirmiausia užpildyk bent vieną vizijos dalį");
    setAnalyzing(true);
    try {
      const { data: auth } = await supabase.auth.getSession();
      const token = auth.session?.access_token;
      if (!token) throw new Error("Nesi prisijungęs");
      const response = await fetch("/api/vision-alignment", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ vision }),
      });
      if (!response.ok) throw new Error(await response.text());
      const data = (await response.json()) as {
        alignments?: { category: Category; value_names: string[]; rationale: string }[];
        reflection?: AlignmentReflection | null;
      };
      const valueIdByName = new Map(values.map((value) => [value.name, value.id]));
      for (const alignment of data.alignments ?? []) {
        setSelectedValues((current) => ({
          ...current,
          [alignment.category]: alignment.value_names
            .map((name) => valueIdByName.get(name))
            .filter((id): id is string => !!id),
        }));
        setValueRationales((current) => ({
          ...current,
          [alignment.category]: alignment.rationale,
        }));
      }
      setReflection(data.reflection ?? null);
      toast.success("AI susiejo viziją su tavo vertybių įrodymais — peržiūrėk pasiūlymus");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nepavyko išanalizuoti vizijos");
    } finally {
      setAnalyzing(false);
    }
  }

  function toggleValue(category: Category, valueId: string) {
    setSelectedValues((current) => ({
      ...current,
      [category]: current[category].includes(valueId)
        ? current[category].filter((id) => id !== valueId)
        : [...current[category], valueId].slice(0, 5),
    }));
  }

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <header className="app-page-header">
        <SidebarTrigger />
        <div>
          <h1 className="font-serif text-xl md:text-2xl">Vizija</h1>
          <p className="hidden text-sm text-muted-foreground sm:block">
            Būti, daryti ir turėti — pagal tai, kas tau iš tikrųjų svarbu.
          </p>
        </div>
      </header>
      <div className="app-page-body">
        <div className="mx-auto max-w-6xl space-y-5">
          <Card className="overflow-hidden border-primary/15 bg-gradient-to-br from-primary/[0.08] via-card to-map-teal/[0.06] p-5 md:p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                  <Compass className="h-4 w-4" /> Tavo pasirinkta ateitis
                </div>
                <h2 className="mt-2 font-serif text-2xl md:text-3xl">
                  Ne ką turėtum — ką renkiesi kurti?
                </h2>
                <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                  Aiški vizija sujungia tapatybę, prasmingą veiklą ir apčiuopiamus rezultatus su
                  tavo aukščiausiomis vertybėmis.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  className="gap-2 bg-background/70"
                  onClick={analyzeAlignment}
                  disabled={analyzing || !values.length}
                >
                  {analyzing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4 text-primary" />
                  )}
                  AI patikrinti suderinamumą
                </Button>
                <div className="rounded-xl border bg-background/70 px-4 py-3 text-center">
                  <div className="font-serif text-2xl">{completion}/3</div>
                  <div className="text-[10px] text-muted-foreground">užpildyta šiame horizonte</div>
                </div>
              </div>
            </div>
          </Card>

          <div className="flex flex-wrap gap-2">
            {HORIZONS.map((item) => (
              <button
                key={item.key}
                onClick={() => setHorizon(item.key)}
                className={cn(
                  "rounded-full border px-4 py-2 text-xs transition",
                  horizon === item.key
                    ? "border-primary bg-primary text-primary-foreground"
                    : "bg-card hover:bg-accent",
                )}
              >
                {item.label}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="text-sm text-muted-foreground">Kraunama…</div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-3">
              {CATEGORIES.map((category) => {
                const draft = drafts[category.key];
                return (
                  <Card key={category.key} className="flex flex-col overflow-hidden">
                    <div className="border-b bg-muted/20 p-4">
                      <div className="flex items-start gap-3">
                        <div
                          className={cn(
                            "flex h-10 w-10 items-center justify-center rounded-xl border",
                            category.accent,
                          )}
                        >
                          <Eye className="h-5 w-5" />
                        </div>
                        <div>
                          <h2 className="font-serif text-xl">{category.title}</h2>
                          <p className="text-xs text-muted-foreground">{category.subtitle}</p>
                        </div>
                        {draft.content && <Check className="ml-auto h-4 w-4 text-map-green" />}
                      </div>
                      <p className="mt-3 text-xs italic leading-relaxed text-muted-foreground">
                        {category.prompt}
                      </p>
                    </div>
                    <div className="flex flex-1 flex-col gap-4 p-4">
                      <Field label="Mano vizija">
                        <Textarea
                          value={draft.content}
                          onChange={(event) =>
                            setDrafts((current) => ({
                              ...current,
                              [category.key]: { ...draft, content: event.target.value },
                            }))
                          }
                          rows={5}
                          placeholder="Rašyk konkrečiai ir savais žodžiais…"
                        />
                      </Field>
                      <Field label="Kodėl tai mano?">
                        <Textarea
                          value={draft.why}
                          onChange={(event) =>
                            setDrafts((current) => ({
                              ...current,
                              [category.key]: { ...draft, why: event.target.value },
                            }))
                          }
                          rows={2}
                          placeholder="Kaip tai susiję su tuo, kas tau svarbiausia?"
                        />
                      </Field>
                      <Field label="Kaip žinosiu, kad realizuoju?">
                        <Textarea
                          value={draft.evidence}
                          onChange={(event) =>
                            setDrafts((current) => ({
                              ...current,
                              [category.key]: { ...draft, evidence: event.target.value },
                            }))
                          }
                          rows={2}
                          placeholder="Kokie konkretūs įrodymai bus matomi?"
                        />
                      </Field>
                      {values.length > 0 && (
                        <div className="space-y-3">
                          <div>
                            <div className="mb-2 text-xs font-medium">Palaikomos vertybės</div>
                            <div className="flex flex-wrap gap-1.5">
                              {values.slice(0, 8).map((value) => {
                                const selected = selectedValues[category.key].includes(value.id);
                                return (
                                  <button
                                    key={value.id}
                                    type="button"
                                    onClick={() => toggleValue(category.key, value.id)}
                                    className={cn(
                                      "rounded-full border px-2.5 py-1 text-xs transition",
                                      selected
                                        ? "border-primary bg-primary/10 text-primary"
                                        : "bg-background text-muted-foreground hover:border-primary/40",
                                    )}
                                  >
                                    {selected && <Check className="mr-1 inline h-3 w-3" />}
                                    {value.name}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                          <Field label="Kodėl šios vertybės palaiko viziją?">
                            <Textarea
                              value={valueRationales[category.key]}
                              onChange={(event) =>
                                setValueRationales((current) => ({
                                  ...current,
                                  [category.key]: event.target.value,
                                }))
                              }
                              rows={3}
                              placeholder="Konkretus ryšys su tavo elgesiu ir vertybių testo įrodymais…"
                            />
                          </Field>
                        </div>
                      )}
                      <Button
                        onClick={() => save(category.key)}
                        disabled={saving === category.key || !draft.content.trim()}
                        className="mt-auto gap-2"
                      >
                        {saving === category.key ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Save className="h-4 w-4" />
                        )}{" "}
                        Išsaugoti
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}

          {reflection && (
            <Card className="border-amber-200 bg-gradient-to-r from-amber-50 to-background p-5 dark:border-amber-900 dark:from-amber-950/20">
              <div className="flex items-start gap-3">
                <div className="rounded-full bg-amber-100 p-2 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                  <AlertCircle className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-sm font-semibold">Vertybių refleksija</div>
                  <p className="mt-1 text-sm text-muted-foreground">{reflection.observation}</p>
                  <p className="mt-3 font-serif text-xl leading-relaxed">{reflection.question}</p>
                </div>
              </div>
            </Card>
          )}

          <Card className="flex items-start gap-3 border-dashed p-4">
            <Sparkles className="mt-0.5 h-4 w-4 text-primary" />
            <div>
              <div className="text-sm font-medium">Kitas etapas</div>
              <p className="mt-1 text-xs text-muted-foreground">
                Iš užpildytos vizijos vėliau galėsime automatiškai pasiūlyti suderintus tikslus ir
                pirmuosius prioritetus.
              </p>
            </div>
            <Badge variant="secondary" className="ml-auto">
              Ruošiama
            </Badge>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium">{label}</span>
      {children}
    </label>
  );
}
