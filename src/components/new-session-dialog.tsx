import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Flame, Compass } from "lucide-react";
import { cn } from "@/lib/utils";

export type SessionMode = "demartini" | "goal_clarify";

export function NewSessionDialog({
  open,
  onOpenChange,
  onPick,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onPick: (mode: SessionMode) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">Kokia sesija šiandien?</DialogTitle>
          <DialogDescription>
            Pasirink režimą – vedlys prisitaikys prie tavo tikslo.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 mt-2">
          <ModeCard
            icon={Flame}
            title="Emocinis balansas"
            subtitle="Demartini 11 etapų"
            desc="Kai kažkas skauda, erzina, neleidžia miego. Išbalansuosim situaciją iki 0/10."
            tone="text-map-orange"
            onClick={() => onPick("demartini")}
          />
          <ModeCard
            icon={Compass}
            title="Tikslo išgryninimas"
            subtitle="8 etapų vedlys"
            desc="Turi norą arba idėją? Padarysim jį konkretų, subalansuotą su vertybėmis ir su pirmu žingsniu."
            tone="text-primary"
            onClick={() => onPick("goal_clarify")}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ModeCard({
  icon: Icon,
  title,
  subtitle,
  desc,
  tone,
  onClick,
}: {
  icon: typeof Flame;
  title: string;
  subtitle: string;
  desc: string;
  tone: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="text-left rounded-xl border p-4 hover:border-primary hover:bg-primary/5 transition-colors"
    >
      <div className="flex items-start gap-3">
        <div className={cn("h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0", tone)}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="flex items-baseline gap-2">
            <h3 className="font-serif text-lg leading-tight">{title}</h3>
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
              {subtitle}
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">{desc}</p>
        </div>
      </div>
    </button>
  );
}
