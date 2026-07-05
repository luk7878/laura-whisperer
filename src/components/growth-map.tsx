import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Target,
  Brain,
  Heart,
  Eye,
  Zap,
  TableProperties,
  TrendingUp,
  MoreHorizontal,
  BookOpen,
  PanelRightClose,
  PanelRightOpen,
} from "lucide-react";
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts";
import { cn } from "@/lib/utils";

export type SessionMapData = {
  topic: string | null;
  belief: string | null;
  emotion: number | null;
  column: string | null;
  patterns: string[];
  grid: Record<string, string>;
};

const GRID_ROWS = [
  { key: "Situacija", tone: "text-map-blue" },
  { key: "Emocija", tone: "text-map-orange" },
  { key: "Problemos sakinys", tone: "text-map-rose" },
  { key: "Naudos", tone: "text-map-green" },
  { key: "Vertybės", tone: "text-map-violet" },
  { key: "Integracija", tone: "text-map-teal" },
];

export function GrowthMap({
  data,
  progress,
}: {
  data: SessionMapData;
  progress?: { day: string; value: number }[];
}) {
  const [collapsed, setCollapsed] = useState(false);

  if (collapsed) {
    return (
      <aside className="w-12 shrink-0 border-l bg-sidebar/50 flex flex-col items-center py-4 gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => setCollapsed(false)}
          title="Išskleisti augimo žemėlapį"
        >
          <PanelRightOpen className="h-4 w-4" />
        </Button>
        <div className="mt-2 text-[10px] uppercase tracking-wider text-muted-foreground [writing-mode:vertical-rl] rotate-180">
          Augimo žemėlapis
        </div>
      </aside>
    );
  }

  return (
    <aside className="w-[340px] shrink-0 border-l bg-sidebar/50 overflow-y-auto">
      <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 border-b bg-sidebar/80 backdrop-blur">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-primary" />
          <h2 className="font-medium text-sm">Augimo žemėlapis</h2>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setCollapsed(true)}
            title="Suskleisti"
          >
            <PanelRightClose className="h-4 w-4 text-muted-foreground" />
          </Button>
          <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
        </div>
      </div>


      <div className="p-4 space-y-3">
        <MapCard
          icon={<Target className="h-4 w-4" />}
          label="Aktyvi tema"
          tint="map-green"
          value={data.topic}
          placeholder="Dar neatpažinta"
        />
        <MapCard
          icon={<Brain className="h-4 w-4" />}
          label="Pagrindinis įsitikinimas"
          tint="map-violet"
          value={data.belief}
          placeholder="Formuojasi"
          multiline
        />

        <Card className="p-4 space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <Heart className="h-4 w-4 text-map-orange" />
            <span className="font-medium">Emocinis krūvis</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-serif" style={{ color: `var(--color-${emotionColor})` }}>
              {data.emotion ?? "—"}
            </span>
            <span className="text-sm text-muted-foreground">/ 10</span>
            <span className={cn("ml-auto text-xs font-medium", `text-${emotionColor}`)}>
              {emotionLabel(data.emotion)}
            </span>
          </div>
          <Progress value={((data.emotion ?? 0) / 10) * 100} className="h-1.5" />
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>0</span>
            <span>10</span>
          </div>
        </Card>

        <Card className="p-4 space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <Eye className="h-4 w-4 text-map-teal" />
            <span className="font-medium">Ką jau matome</span>
          </div>
          {data.patterns.length === 0 ? (
            <p className="text-xs text-muted-foreground">Šablonai atsiras pokalbio metu.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {data.patterns.slice(0, 10).map((p) => (
                <Badge key={p} variant="secondary" className="rounded-full font-normal">
                  {p}
                </Badge>
              ))}
            </div>
          )}
        </Card>

        <MapCard
          icon={<Zap className="h-4 w-4" />}
          label="Aktyvus stulpelis"
          tint="map-violet"
          value={data.column}
          placeholder="Įžanga"
        />

        <Card className="p-4 space-y-2.5">
          <div className="flex items-center gap-2 text-sm">
            <TableProperties className="h-4 w-4 text-primary" />
            <span className="font-medium">Lentelės būsena</span>
          </div>
          <div className="space-y-1.5">
            {GRID_ROWS.map((row) => {
              const val = data.grid[row.key];
              return (
                <div key={row.key} className="grid grid-cols-[100px_1fr] gap-2 text-xs">
                  <div className={cn("flex items-center gap-1.5 font-medium", row.tone)}>
                    <span className="h-1.5 w-1.5 rounded-full bg-current" />
                    {row.key}
                  </div>
                  <div className="text-muted-foreground truncate">
                    {val || <span className="italic opacity-60">—</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {progress && progress.length > 1 && (
          <Card className="p-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-map-green" />
                <span className="font-medium">Progreso pokytis</span>
              </div>
              <span className="text-[10px] text-muted-foreground">Per 7 dienas</span>
            </div>
            <div className="h-24">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={progress} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <XAxis dataKey="day" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                  <YAxis hide domain={[-10, 10]} />
                  <Tooltip cursor={false} contentStyle={{ fontSize: 11 }} />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="var(--color-map-green)"
                    strokeWidth={2}
                    dot={{ r: 2.5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        )}
      </div>
    </aside>
  );
}

function MapCard({
  icon,
  label,
  value,
  placeholder,
  tint,
  multiline,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | null;
  placeholder: string;
  tint: string;
  multiline?: boolean;
}) {
  return (
    <Card className="p-4">
      <div className={cn("flex items-center gap-2 text-xs uppercase tracking-wider", `text-${tint}`)}>
        {icon}
        <span>{label}</span>
      </div>
      <div
        className={cn(
          "mt-1.5 font-medium text-foreground",
          multiline ? "text-sm leading-snug" : "text-base truncate",
          !value && "text-muted-foreground/70 italic font-normal",
        )}
      >
        {value || placeholder}
      </div>
    </Card>
  );
}

function emotionTone(v: number | null) {
  if (v == null) return "muted-foreground";
  if (v >= 8) return "map-rose";
  if (v >= 5) return "map-orange";
  if (v >= 3) return "map-teal";
  return "map-green";
}

function emotionLabel(v: number | null) {
  if (v == null) return "";
  if (v >= 8) return "Aukštas";
  if (v >= 5) return "Vidutinis";
  if (v >= 3) return "Švelnus";
  return "Ramus";
}
