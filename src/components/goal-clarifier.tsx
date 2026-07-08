import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Target,
  Compass,
  Heart,
  Sparkles,
  Scale,
  AlertTriangle,
  Flag,
  PanelRightClose,
  PanelRightOpen,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type GoalClarifierData = {
  stage: string | null;
  goal_draft: string | null;
  why: string | null;
  value: string | null;
  benefits: string | null;
  costs: string | null;
  obstacles: string | null;
  first_step: string | null;
  ready_to_save: boolean;
  patterns: string[];
};

const STAGES = [
  "Neapdirbtas noras",
  "Konkretumas",
  "Tikroji priežastis",
  "Vertybių patikra",
  "Nauda 7 srityse",
  "Kaina",
  "Kliūtys",
  "Pirmas veiksmas",
];

export function GoalClarifier({
  data,
  onSave,
}: {
  data: GoalClarifierData;
  onSave: () => void;
}) {
  const [open, setOpen] = useState(true);
  const stageIndex = data.stage ? STAGES.findIndex((s) => data.stage?.includes(s)) : -1;
  const progress = stageIndex >= 0 ? Math.round(((stageIndex + 1) / STAGES.length) * 100) : 0;

  if (!open) {
    return (
      <div className="border-l bg-background flex flex-col items-center py-4 gap-3 w-12 shrink-0">
        <button
          onClick={() => setOpen(true)}
          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent"
          title="Rodyti tikslo panelę"
        >
          <PanelRightOpen className="h-4 w-4" />
        </button>
        <Target className="h-4 w-4 text-primary" />
      </div>
    );
  }

  return (
    <aside className="hidden lg:flex border-l bg-background w-[340px] shrink-0 flex-col min-h-0">
      <div className="border-b p-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <Compass className="h-4 w-4" />
          </div>
          <div className="leading-tight">
            <div className="font-serif text-base">Tikslo išgryninimas</div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
              8 etapų vedlys
            </div>
          </div>
        </div>
        <button
          onClick={() => setOpen(false)}
          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent"
          title="Slėpti"
        >
          <PanelRightClose className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {/* Progresas */}
        <Card className="p-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
            <span>Etapas</span>
            <span>{progress}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="text-sm font-medium mt-2">
            {data.stage ?? "Dar neprasidėjo"}
          </div>
        </Card>

        <Section icon={Flag} title="Tikslo juodraštis" tone="text-map-blue">
          {data.goal_draft || <Empty>Kol kas neapibrėžtas.</Empty>}
        </Section>

        <Section icon={Sparkles} title="Kodėl (tikroji priežastis)" tone="text-map-teal">
          {data.why || <Empty>Kol kas neišsakyta.</Empty>}
        </Section>

        <Section icon={Heart} title="Aukščiausia vertybė" tone="text-map-violet">
          {data.value ? (
            <Badge variant="outline" className="text-xs">{data.value}</Badge>
          ) : (
            <Empty>Dar nepatikrinta.</Empty>
          )}
        </Section>

        <Section icon={Scale} title="Nauda 7 srityse" tone="text-map-green">
          {data.benefits ? (
            <ul className="space-y-1 list-disc list-inside text-foreground/90">
              {data.benefits.split(";").map((b, i) => b.trim() && <li key={i}>{b.trim()}</li>)}
            </ul>
          ) : (
            <Empty>Dar neaptarta.</Empty>
          )}
        </Section>

        <Section icon={Scale} title="Kaina ir aukos" tone="text-map-orange">
          {data.costs ? (
            <ul className="space-y-1 list-disc list-inside text-foreground/90">
              {data.costs.split(";").map((c, i) => c.trim() && <li key={i}>{c.trim()}</li>)}
            </ul>
          ) : (
            <Empty>Nepamiršk kainos – be jos tikslas neišgyvens.</Empty>
          )}
        </Section>

        <Section icon={AlertTriangle} title="Kliūtys" tone="text-map-rose">
          {data.obstacles ? (
            <ul className="space-y-1 list-disc list-inside text-foreground/90">
              {data.obstacles.split(";").map((o, i) => o.trim() && <li key={i}>{o.trim()}</li>)}
            </ul>
          ) : (
            <Empty>Dar neįvardintos.</Empty>
          )}
        </Section>

        <Section icon={Target} title="Pirmas žingsnis" tone="text-primary">
          {data.first_step || <Empty>Bus pasiūlytas 8 etape.</Empty>}
        </Section>

        {data.patterns.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {data.patterns.map((p) => (
              <Badge key={p} variant="secondary" className="text-[10px]">
                {p}
              </Badge>
            ))}
          </div>
        )}
      </div>

      <div className="border-t p-4">
        <Button
          onClick={onSave}
          className="w-full gap-2"
          disabled={!data.goal_draft}
        >
          <CheckCircle2 className="h-4 w-4" />
          {data.ready_to_save ? "Perkelti į Tikslus" : "Peržiūrėti ir išsaugoti"}
        </Button>
        <p className="text-[11px] text-muted-foreground text-center mt-2">
          Sukursim tikslą + pirmą žingsnį prioritetuose.
        </p>
      </div>
    </aside>
  );
}

function Section({
  icon: Icon,
  title,
  tone,
  children,
}: {
  icon: typeof Target;
  title: string;
  tone: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="p-3">
      <div className={cn("flex items-center gap-1.5 text-xs font-medium mb-1.5", tone)}>
        <Icon className="h-3.5 w-3.5" />
        {title}
      </div>
      <div className="text-sm">{children}</div>
    </Card>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <span className="text-xs text-muted-foreground italic">{children}</span>;
}
