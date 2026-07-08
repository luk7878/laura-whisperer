import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listClarityBookings, generateBookingSummary } from "@/lib/admin.functions";
import {
  getSlotState,
  updateSlotCapacity,
  resetSlotFilled,
  listWaitlist,
  updateWaitlistStatus,
} from "@/lib/slots.functions";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Loader2, Sparkles, ShieldAlert, Star, KeyRound, Plus, Trash2, Copy, Users, RefreshCw } from "lucide-react";
import { Switch } from "@/components/ui/switch";

import { toast } from "sonner";


export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminPage,
});

type Booking = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  contact_email: string | null;
  concern: string | null;
  status: string | null;
  scheduled_at: string | null;
  emotional_start: number | null;
  emotional_end: number | null;
  safety_triggered: boolean | null;
  safety_reason: string | null;
  summary: Record<string, string> | null;
  feedback: string | null;
  helpfulness_rating: number | null;
  wants_subscription: boolean | null;
  wants_human_session: boolean | null;
  human_session_requested_at: string | null;
  human_session_preferred_at: string | null;
  human_session_note: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
};

function fmt(dt: string | null) {
  if (!dt) return "—";
  return new Date(dt).toLocaleString("lt-LT", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function statusBadge(b: Booking) {
  if (b.wants_human_session) {
    return <Badge className="bg-amber-600 hover:bg-amber-600">Laukia sesijos su žmogumi</Badge>;
  }
  if (b.safety_triggered) {
    return <Badge variant="destructive">Saugos signalas</Badge>;
  }
  if (b.status === "completed") return <Badge className="bg-emerald-600 hover:bg-emerald-600">Užbaigta</Badge>;
  if (b.status === "in_progress") return <Badge className="bg-blue-600 hover:bg-blue-600">Vyksta</Badge>;
  return <Badge variant="secondary">{b.status ?? "nauja"}</Badge>;
}

function AdminPage() {
  const list = useServerFn(listClarityBookings);
  const genSummary = useServerFn(generateBookingSummary);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "human" | "completed" | "rated">("all");

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", u.user.id)
        .eq("role", "admin")
        .maybeSingle();
      setIsAdmin(!!data);
      setChecking(false);
    })();
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      setLoading(true);
      try {
        const res = await list();
        setBookings(res.bookings as Booking[]);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Klaida");
      } finally {
        setLoading(false);
      }
    })();
  }, [isAdmin, list]);

  const filtered = useMemo(() => {
    let arr = bookings;
    if (filter === "human") arr = arr.filter((b) => b.wants_human_session);
    if (filter === "completed") arr = arr.filter((b) => b.status === "completed");
    if (filter === "rated") arr = arr.filter((b) => b.helpfulness_rating != null);
    if (q.trim()) {
      const s = q.toLowerCase();
      arr = arr.filter(
        (b) =>
          (b.name ?? "").toLowerCase().includes(s) ||
          (b.email ?? "").toLowerCase().includes(s) ||
          (b.concern ?? "").toLowerCase().includes(s),
      );
    }
    return arr;
  }, [bookings, filter, q]);

  async function onGenerate(id: string) {
    setBusy(id);
    try {
      const res = await genSummary({ data: { bookingId: id } });
      setBookings((bs) => bs.map((b) => (b.id === id ? { ...b, summary: res.summary } : b)));
      toast.success("Santrauka sugeneruota");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Nepavyko");
    } finally {
      setBusy(null);
    }
  }

  if (checking) {
    return (
      <div className="p-8 flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Tikrinama prieiga…
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="max-w-xl mx-auto p-8">
        <Card className="p-6 text-center">
          <ShieldAlert className="h-8 w-8 mx-auto text-destructive mb-3" />
          <h1 className="font-serif text-xl mb-2">Prieiga uždrausta</h1>
          <p className="text-sm text-muted-foreground">
            Ši sritis pasiekiama tik administratoriams.
          </p>
        </Card>
      </div>
    );
  }

  const stats = {
    total: bookings.length,
    human: bookings.filter((b) => b.wants_human_session).length,
    completed: bookings.filter((b) => b.status === "completed").length,
    rated: bookings.filter((b) => b.helpfulness_rating != null).length,
  };

  return (
    <div className="max-w-6xl mx-auto w-full p-4 md:p-6 space-y-4">
      <div>
        <h1 className="font-serif text-2xl mb-1">Admin — 15 min sesijos</h1>
        <p className="text-sm text-muted-foreground">
          Registracijos, statusai, AI santraukos ir įvertinimai.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Stat label="Viso" value={stats.total} onClick={() => setFilter("all")} active={filter === "all"} />
        <Stat label="Laukia žmogaus" value={stats.human} onClick={() => setFilter("human")} active={filter === "human"} />
        <Stat label="Užbaigtos" value={stats.completed} onClick={() => setFilter("completed")} active={filter === "completed"} />
        <Stat label="Įvertintos" value={stats.rated} onClick={() => setFilter("rated")} active={filter === "rated"} />
      </div>

      <Input
        placeholder="Ieškoti pagal vardą, el. paštą arba temą…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />

      <InviteCodesPanel />


      {loading ? (
        <div className="p-8 flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Kraunama…
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">Nėra įrašų.</Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((b) => (
            <BookingRow key={b.id} b={b} busy={busy === b.id} onGenerate={() => onGenerate(b.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  onClick,
  active,
}: {
  label: string;
  value: number;
  onClick: () => void;
  active: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`text-left rounded-lg border p-3 transition hover:bg-accent ${active ? "border-primary bg-accent/60" : ""}`}
    >
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-2xl font-serif">{value}</div>
    </button>
  );
}

function BookingRow({
  b,
  busy,
  onGenerate,
}: {
  b: Booking;
  busy: boolean;
  onGenerate: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-start gap-2 justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-medium truncate">{b.name || "—"}</h3>
            {statusBadge(b)}
            {b.helpfulness_rating != null && (
              <span className="inline-flex items-center gap-0.5 text-amber-600 text-sm">
                <Star className="h-3.5 w-3.5 fill-current" /> {b.helpfulness_rating}/5
              </span>
            )}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {b.email ?? "—"}
            {b.phone ? ` · ${b.phone}` : ""}
            {" · registruotas "}
            {fmt(b.created_at)}
          </div>
          {b.concern && (
            <p className="text-sm mt-2 line-clamp-2">
              <span className="text-muted-foreground">Tema: </span>
              {b.concern}
            </p>
          )}
        </div>
        <Button size="sm" variant="ghost" onClick={() => setOpen((o) => !o)}>
          {open ? "Slėpti" : "Detaliau"}
        </Button>
      </div>

      {open && (
        <div className="mt-3 pt-3 border-t space-y-3 text-sm">
          <div className="grid md:grid-cols-2 gap-3">
            <Field label="Emocinė būsena pradžioj / pabaigoj">
              {b.emotional_start ?? "—"} → {b.emotional_end ?? "—"}
            </Field>
            <Field label="Statusas">{b.status ?? "—"}</Field>
            <Field label="Pradėta">{fmt(b.started_at)}</Field>
            <Field label="Užbaigta">{fmt(b.completed_at)}</Field>
          </div>

          {b.wants_human_session && (
            <div className="rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 p-3">
              <div className="font-medium text-amber-900 dark:text-amber-200 mb-1">
                Nori sesijos su žmogumi
              </div>
              <div className="text-xs text-amber-900/80 dark:text-amber-200/80 space-y-0.5">
                <div>Užklausa: {fmt(b.human_session_requested_at)}</div>
                <div>Pageidaujamas laikas: {fmt(b.human_session_preferred_at)}</div>
                {b.human_session_note && <div>Pastaba: {b.human_session_note}</div>}
                {b.contact_email && <div>Kontaktinis el. paštas: {b.contact_email}</div>}
              </div>
            </div>
          )}

          {b.safety_triggered && (
            <div className="rounded-md bg-destructive/10 border border-destructive/30 p-3">
              <div className="font-medium text-destructive mb-1">Saugos signalas</div>
              <div className="text-xs">{b.safety_reason ?? "—"}</div>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                AI santrauka
              </div>
              <Button size="sm" variant="outline" onClick={onGenerate} disabled={busy}>
                {busy ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                )}
                {b.summary ? "Pergeneruoti" : "Generuoti"}
              </Button>
            </div>
            {b.summary ? (
              <div className="rounded-md bg-muted/50 p-3 space-y-1.5">
                {b.summary.topic && <div><b>Tema:</b> {b.summary.topic}</div>}
                {b.summary.insight && <div><b>Įžvalga:</b> {b.summary.insight}</div>}
                {b.summary.action && <div><b>Veiksmas:</b> {b.summary.action}</div>}
                {b.summary.next_step && <div><b>Kitas žingsnis:</b> {b.summary.next_step}</div>}
              </div>
            ) : (
              <div className="text-xs text-muted-foreground">Dar nesugeneruota.</div>
            )}
          </div>

          {b.feedback && (
            <Field label="Atsiliepimas">
              <p className="whitespace-pre-wrap">{b.feedback}</p>
            </Field>
          )}

          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
            {b.wants_subscription && <span>✉︎ Nori prenumeratos</span>}
          </div>
        </div>
      )}
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-muted-foreground mb-0.5">{label}</div>
      <div>{children}</div>
    </div>
  );
}

type InviteCode = {
  id: string;
  code: string;
  note: string | null;
  active: boolean;
  max_uses: number | null;
  uses: number;
  expires_at: string | null;
  created_at: string;
};

function InviteCodesPanel() {
  const [codes, setCodes] = useState<InviteCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [newCode, setNewCode] = useState("");
  const [newNote, setNewNote] = useState("");
  const [newMax, setNewMax] = useState<string>("");

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("invite_codes")
      .select("id, code, note, active, max_uses, uses, expires_at, created_at")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setCodes((data ?? []) as InviteCode[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  function randomCode() {
    const s = Math.random().toString(36).slice(2, 8).toUpperCase();
    setNewCode(`LB-${s}`);
  }

  async function create() {
    const code = newCode.trim();
    if (!code) {
      toast.error("Įveskite kodą");
      return;
    }
    const { error } = await supabase.from("invite_codes").insert({
      code,
      note: newNote.trim() || null,
      max_uses: newMax ? Number(newMax) : null,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    setNewCode("");
    setNewNote("");
    setNewMax("");
    toast.success("Kodas sukurtas");
    load();
  }

  async function toggle(id: string, active: boolean) {
    const { error } = await supabase.from("invite_codes").update({ active }).eq("id", id);
    if (error) toast.error(error.message);
    else setCodes((cs) => cs.map((c) => (c.id === id ? { ...c, active } : c)));
  }

  async function remove(id: string) {
    if (!confirm("Ištrinti kodą?")) return;
    const { error } = await supabase.from("invite_codes").delete().eq("id", id);
    if (error) toast.error(error.message);
    else setCodes((cs) => cs.filter((c) => c.id !== id));
  }

  return (
    <Card className="p-4">
      <button
        className="w-full flex items-center justify-between"
        onClick={() => setOpen((o) => !o)}
      >
        <div className="flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-primary" />
          <span className="font-medium">Pakvietimo kodai</span>
          <Badge variant="secondary">{codes.filter((c) => c.active).length} aktyvūs</Badge>
        </div>
        <span className="text-xs text-muted-foreground">{open ? "Slėpti" : "Rodyti"}</span>
      </button>

      {open && (
        <div className="mt-4 space-y-4">
          <div className="rounded-md border p-3 space-y-2 bg-muted/30">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Naujas kodas
            </div>
            <div className="flex gap-2 flex-wrap">
              <Input
                placeholder="Kodas (pvz. LB-ALFA)"
                value={newCode}
                onChange={(e) => setNewCode(e.target.value)}
                className="flex-1 min-w-[160px]"
              />
              <Button type="button" size="sm" variant="ghost" onClick={randomCode}>
                Generuoti
              </Button>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Input
                placeholder="Pastaba (kam skirtas)"
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                className="flex-1 min-w-[160px]"
              />
              <Input
                type="number"
                min={1}
                placeholder="Max. panaudojimų (tuščia = neribota)"
                value={newMax}
                onChange={(e) => setNewMax(e.target.value)}
                className="w-56"
              />
              <Button size="sm" onClick={create}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Sukurti
              </Button>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Loader2 className="h-4 w-4 animate-spin" /> Kraunama…
            </div>
          ) : codes.length === 0 ? (
            <p className="text-sm text-muted-foreground">Kodų dar nėra.</p>
          ) : (
            <div className="divide-y">
              {codes.map((c) => (
                <div key={c.id} className="py-2 flex items-center gap-3 flex-wrap">
                  <code className="font-mono text-sm bg-muted px-2 py-1 rounded">{c.code}</code>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      navigator.clipboard.writeText(c.code);
                      toast.success("Nukopijuota");
                    }}
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                  <div className="text-xs text-muted-foreground flex-1 min-w-[120px]">
                    {c.note || "—"} · panaudota {c.uses}
                    {c.max_uses ? `/${c.max_uses}` : ""}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {c.active ? "Aktyvus" : "Išjungtas"}
                    </span>
                    <Switch
                      checked={c.active}
                      onCheckedChange={(v) => toggle(c.id, v)}
                    />
                    <Button size="sm" variant="ghost" onClick={() => remove(c.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

