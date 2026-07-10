import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Activity,
  ArrowRight,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleDot,
  Clock3,
  Filter,
  MessageSquare,
  Search,
  Sparkles,
  Tag,
  TrendingDown,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/journal")({
  component: JournalPage,
});

type JournalEntry = {
  id: string;
  session_id: string | null;
  summary: string;
  patterns: string[] | null;
  created_at: string;
};

type SessionRow = {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  emotional_start: number | null;
  emotional_current: number | null;
  emotional_end: number | null;
  active_topic: string | null;
  patterns: string[] | null;
  status: string | null;
};

type StatusFilter = "all" | "active" | "closed" | "improved";
type PeriodFilter = "all" | "7" | "30" | "90";

function JournalPage() {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [period, setPeriod] = useState<PeriodFilter>("all");
  const [selectedPattern, setSelectedPattern] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [{ data: e }, { data: s }] = await Promise.all([
        supabase
          .from("journal_entries")
          .select("id, session_id, summary, patterns, created_at")
          .order("created_at", { ascending: false }),
        supabase
          .from("sessions")
          .select(
            "id, title, created_at, updated_at, emotional_start, emotional_current, emotional_end, active_topic, patterns, status",
          )
          .order("updated_at", { ascending: false }),
      ]);
      setEntries((e as JournalEntry[]) ?? []);
      setSessions((s as SessionRow[]) ?? []);
      setLoading(false);
    })();
  }, []);

  const entryBySession = useMemo(() => {
    const map = new Map<string, JournalEntry>();
    for (const entry of entries) {
      if (entry.session_id && !map.has(entry.session_id)) map.set(entry.session_id, entry);
    }
    return map;
  }, [entries]);

  const patterns = useMemo(() => {
    const counts = new Map<string, number>();
    for (const session of sessions) {
      const entry = entryBySession.get(session.id);
      for (const pattern of [...(session.patterns ?? []), ...(entry?.patterns ?? [])]) {
        const clean = pattern.trim();
        if (clean) counts.set(clean, (counts.get(clean) ?? 0) + 1);
      }
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [sessions, entryBySession]);

  const filtered = useMemo(() => {
    const term = q.trim().toLocaleLowerCase("lt");
    const now = Date.now();
    return sessions.filter((session) => {
      const entry = entryBySession.get(session.id);
      const delta = getDelta(session);
      const allPatterns = [...(session.patterns ?? []), ...(entry?.patterns ?? [])];
      const matchesSearch =
        !term ||
        session.title.toLocaleLowerCase("lt").includes(term) ||
        (session.active_topic ?? "").toLocaleLowerCase("lt").includes(term) ||
        (entry?.summary ?? "").toLocaleLowerCase("lt").includes(term) ||
        allPatterns.some((pattern) => pattern.toLocaleLowerCase("lt").includes(term));
      const matchesStatus =
        status === "all" ||
        (status === "active" && session.status === "active") ||
        (status === "closed" && session.status !== "active") ||
        (status === "improved" && delta != null && delta < 0);
      const matchesPeriod =
        period === "all" ||
        now - new Date(session.updated_at).getTime() <= Number(period) * 86_400_000;
      const matchesPattern = !selectedPattern || allPatterns.includes(selectedPattern);
      return matchesSearch && matchesStatus && matchesPeriod && matchesPattern;
    });
  }, [sessions, entryBySession, q, status, period, selectedPattern]);

  const completed = sessions.filter((session) => session.status !== "active").length;
  const improved = sessions.filter((session) => (getDelta(session) ?? 0) < 0);
  const averageRelief = improved.length
    ? improved.reduce((sum, session) => sum + Math.abs(getDelta(session)!), 0) / improved.length
    : null;
  const thisMonth = sessions.filter((session) => {
    const date = new Date(session.created_at);
    const now = new Date();
    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  }).length;
  const filtersActive =
    status !== "all" || period !== "all" || selectedPattern != null || q.length > 0;

  function resetFilters() {
    setQ("");
    setStatus("all");
    setPeriod("all");
    setSelectedPattern(null);
  }

  function toggleExpanded(id: string) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <header className="border-b bg-background/80 backdrop-blur px-3 md:px-6 py-3 md:py-4 flex items-center gap-2 md:gap-3">
        <SidebarTrigger className="shrink-0" />
        <div className="flex-1 min-w-0">
          <h1 className="font-serif text-xl md:text-2xl leading-tight">Augimo žurnalas</h1>
          <p className="text-xs md:text-sm text-muted-foreground hidden sm:block truncate">
            Tavo sesijos, įžvalgos ir pasikartojančios temos vienoje vietoje.
          </p>
        </div>
        <Button asChild size="sm" className="gap-2">
          <Link to="/session">
            <MessageSquare className="h-4 w-4" />
            <span className="hidden sm:inline">Nauja sesija</span>
          </Link>
        </Button>
      </header>

      <div className="flex-1 overflow-y-auto bg-muted/20 p-3 md:p-6">
        <div className="mx-auto max-w-6xl space-y-5">
          {!loading && sessions.length > 0 && (
            <>
              <Card className="relative overflow-hidden border-primary/15 bg-gradient-to-br from-primary/[0.08] via-card to-map-violet/[0.05] p-5 md:p-6">
                <div className="absolute -right-10 -top-16 h-44 w-44 rounded-full bg-primary/10 blur-3xl" />
                <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                      <Sparkles className="h-4 w-4" /> Tavo kelionė
                    </div>
                    <h2 className="mt-2 font-serif text-2xl md:text-3xl">
                      {sessions.length} prasmingų sustojimų sau
                    </h2>
                    <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                      Žurnalas padeda pastebėti ne pavienes dienas, o kryptį: kas kartojasi, kas
                      keičiasi ir kur jau atsirado daugiau aiškumo.
                    </p>
                  </div>
                  <Button asChild variant="outline" className="shrink-0 bg-background/70">
                    <Link to="/insights">
                      Peržiūrėti įžvalgas <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </Card>

              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Metric icon={BookOpen} label="Visos sesijos" value={sessions.length} />
                <Metric icon={CheckCircle2} label="Užbaigtos" value={completed} />
                <Metric icon={CalendarDays} label="Šį mėnesį" value={thisMonth} />
                <Metric
                  icon={TrendingDown}
                  label="Vid. palengvėjimas"
                  value={averageRelief == null ? "—" : averageRelief.toFixed(1)}
                  accent
                />
              </div>
            </>
          )}

          <Card className="p-3 md:p-4">
            <div className="flex flex-col gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={q}
                  onChange={(event) => setQ(event.target.value)}
                  placeholder="Ieškoti sesijose, santraukose ir temose…"
                  className="h-11 pl-9 pr-10"
                />
                {q && (
                  <button
                    onClick={() => setQ("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label="Išvalyti paiešką"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="mr-1 flex items-center gap-1 text-xs text-muted-foreground">
                  <Filter className="h-3.5 w-3.5" /> Būsena
                </span>
                <FilterButton active={status === "all"} onClick={() => setStatus("all")}>
                  Visos
                </FilterButton>
                <FilterButton active={status === "active"} onClick={() => setStatus("active")}>
                  Aktyvios
                </FilterButton>
                <FilterButton active={status === "closed"} onClick={() => setStatus("closed")}>
                  Užbaigtos
                </FilterButton>
                <FilterButton active={status === "improved"} onClick={() => setStatus("improved")}>
                  Su palengvėjimu
                </FilterButton>
                <span className="mx-1 hidden h-5 w-px bg-border sm:block" />
                <select
                  value={period}
                  onChange={(event) => setPeriod(event.target.value as PeriodFilter)}
                  className="h-8 rounded-md border bg-background px-2 text-xs outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="all">Visas laikas</option>
                  <option value="7">7 dienos</option>
                  <option value="30">30 dienų</option>
                  <option value="90">90 dienų</option>
                </select>
                {filtersActive && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 text-xs"
                    onClick={resetFilters}
                  >
                    Išvalyti filtrus
                  </Button>
                )}
              </div>
            </div>
          </Card>

          {patterns.length > 0 && (
            <div>
              <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <Tag className="h-3.5 w-3.5" /> Dažniausios temos
              </div>
              <div className="flex flex-wrap gap-2">
                {patterns.map(([pattern, count]) => (
                  <button
                    key={pattern}
                    onClick={() => setSelectedPattern(selectedPattern === pattern ? null : pattern)}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-xs transition",
                      selectedPattern === pattern
                        ? "border-primary bg-primary text-primary-foreground"
                        : "bg-card hover:border-primary/40 hover:bg-accent",
                    )}
                  >
                    <span>{pattern}</span>
                    <span className="ml-1.5 opacity-65">{count}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {loading && <JournalSkeleton />}

          {!loading && sessions.length === 0 && (
            <Card className="border-dashed p-10 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <BookOpen className="h-7 w-7" />
              </div>
              <h2 className="font-serif text-2xl">Pradėk savo augimo žurnalą</h2>
              <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                Po kiekvienos sesijos čia rasi santrauką, emocinį pokytį ir temas, prie kurių verta
                sugrįžti.
              </p>
              <Button asChild className="mt-5">
                <Link to="/session">Pradėti pirmą sesiją</Link>
              </Button>
            </Card>
          )}

          {!loading && sessions.length > 0 && filtered.length === 0 && (
            <Card className="border-dashed p-8 text-center">
              <Search className="mx-auto h-7 w-7 text-muted-foreground" />
              <h2 className="mt-3 font-serif text-xl">Nieko neradome</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Pabandyk kitą paiešką arba išvalyk filtrus.
              </p>
              <Button variant="outline" size="sm" className="mt-4" onClick={resetFilters}>
                Rodyti visas sesijas
              </Button>
            </Card>
          )}

          {!loading && filtered.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Sesijų istorija
                </h2>
                <span className="text-xs text-muted-foreground">
                  Rodoma {filtered.length} iš {sessions.length}
                </span>
              </div>
              {filtered.map((session) => (
                <SessionCard
                  key={session.id}
                  session={session}
                  entry={entryBySession.get(session.id)}
                  expanded={expanded.has(session.id)}
                  onToggle={() => toggleExpanded(session.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function getDelta(session: SessionRow) {
  return session.emotional_start != null && session.emotional_end != null
    ? session.emotional_end - session.emotional_start
    : null;
}

function Metric({
  icon: Icon,
  label,
  value,
  accent = false,
}: {
  icon: typeof BookOpen;
  label: string;
  value: string | number;
  accent?: boolean;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-[11px] text-muted-foreground md:text-xs">{label}</div>
          <div className={cn("mt-1 font-serif text-2xl md:text-3xl", accent && "text-map-green")}>
            {value}
          </div>
        </div>
        <div
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-lg",
            accent ? "bg-map-green/15 text-map-green" : "bg-muted text-muted-foreground",
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </Card>
  );
}

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "h-8 rounded-full border px-3 text-xs transition",
        active
          ? "border-primary bg-primary/10 text-primary"
          : "bg-background text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function SessionCard({
  session,
  entry,
  expanded,
  onToggle,
}: {
  session: SessionRow;
  entry?: JournalEntry;
  expanded: boolean;
  onToggle: () => void;
}) {
  const delta = getDelta(session);
  const patterns = [...new Set([...(session.patterns ?? []), ...(entry?.patterns ?? [])])];
  const isActive = session.status === "active";
  return (
    <Card className="overflow-hidden transition-shadow hover:shadow-md">
      <div className="p-4 md:p-5">
        <div className="flex items-start gap-3 md:gap-4">
          <div
            className={cn(
              "mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
              isActive ? "bg-primary/10 text-primary" : "bg-map-green/10 text-map-green",
            )}
          >
            {isActive ? <CircleDot className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="min-w-0 font-medium leading-snug md:text-base">{session.title}</h3>
              <Badge variant={isActive ? "secondary" : "outline"} className="text-[10px]">
                {isActive ? "Aktyvi" : "Užbaigta"}
              </Badge>
              {delta != null && (
                <Badge
                  variant="outline"
                  className={cn(
                    "gap-1 text-[10px]",
                    delta < 0
                      ? "border-map-green/30 bg-map-green/10 text-map-green"
                      : delta > 0
                        ? "border-map-rose/30 bg-map-rose/10 text-map-rose"
                        : "",
                  )}
                >
                  <Activity className="h-3 w-3" />
                  {delta < 0
                    ? `${Math.abs(delta)} bal. lengviau`
                    : delta > 0
                      ? `+${delta} bal.`
                      : "Be pokyčio"}
                </Badge>
              )}
            </div>
            {session.active_topic && (
              <p className="mt-1 text-sm text-muted-foreground">{session.active_topic}</p>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <CalendarDays className="h-3 w-3" />
                {new Date(session.updated_at).toLocaleDateString("lt-LT", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </span>
              <span className="flex items-center gap-1">
                <Clock3 className="h-3 w-3" />
                {new Date(session.updated_at).toLocaleTimeString("lt-LT", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
            {patterns.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {patterns.slice(0, expanded ? patterns.length : 3).map((pattern) => (
                  <Badge key={pattern} variant="secondary" className="text-[10px] font-normal">
                    {pattern}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>

        {entry?.summary && (
          <div className={cn("ml-0 mt-4 border-t pt-4 md:ml-14", !expanded && "hidden sm:block")}>
            <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-foreground">
              <Sparkles className="h-3.5 w-3.5 text-primary" /> Sesijos santrauka
            </div>
            <p
              className={cn(
                "whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground",
                !expanded && "line-clamp-2",
              )}
            >
              {entry.summary}
            </p>
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t bg-muted/20 px-4 py-2.5 md:px-5">
        <button
          onClick={onToggle}
          className="flex h-8 items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          {expanded ? (
            <>
              <ChevronUp className="h-3.5 w-3.5" /> Suskleisti
            </>
          ) : (
            <>
              <ChevronDown className="h-3.5 w-3.5" /> Rodyti daugiau
            </>
          )}
        </button>
        <div className="flex items-center gap-1">
          <Button asChild variant="ghost" size="sm" className="h-8 gap-1.5 text-xs">
            <Link to="/ask" search={{ session: session.id }}>
              <Sparkles className="h-3.5 w-3.5" /> Aptarti su mentoriumi
            </Link>
          </Button>
          <Button asChild size="sm" className="h-8 gap-1.5 text-xs">
            <Link to="/session" search={{ s: session.id }}>
              {isActive ? "Tęsti" : "Atverti"}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </div>
    </Card>
  );
}

function JournalSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((item) => (
        <Card key={item} className="p-5">
          <div className="flex gap-4">
            <div className="h-10 w-10 animate-pulse rounded-xl bg-muted" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
              <div className="h-3 w-1/3 animate-pulse rounded bg-muted" />
              <div className="h-3 w-full animate-pulse rounded bg-muted" />
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
