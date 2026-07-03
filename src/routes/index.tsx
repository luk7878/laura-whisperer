import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Sparkles, Brain, Mic, Target, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Demartini Coach AI — Asistentas koučeriams" },
      {
        name: "description",
        content:
          "Dirbtinio intelekto asistentas, padedantis koučeriams taikyti Demartini metodą: nustato emocinį krūvį, parenka Formą A/B, stulpelį ir siūlo galingus klausimus.",
      },
      { property: "og:title", content: "Demartini Coach AI" },
      { property: "og:description", content: "AI asistentas Demartini metodo koučeriams." },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2 text-primary">
          <Sparkles className="h-6 w-6" />
          <span className="font-semibold">Demartini Coach AI</span>
        </div>
        <Link to="/auth">
          <Button variant="ghost" size="sm">Prisijungti</Button>
        </Link>
      </header>

      <main className="mx-auto max-w-4xl px-6 pt-16 pb-24 text-center">
        <h1 className="text-5xl md:text-6xl font-bold tracking-tight text-foreground">
          AI asistentas <span className="text-primary">Demartini metodo</span> koučeriams
        </h1>
        <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto">
          Įrašykite arba parašykite kliento pasisakymą — asistentas realiu laiku
          nustato emocinį krūvį, parenka tinkamą Formą (A ar B), tikslinį stulpelį
          ir pasiūlo 3 galingus klausimus sesijai.
        </p>
        <div className="mt-10 flex items-center justify-center gap-3">
          <Link to="/auth">
            <Button size="lg" className="gap-2">
              Pradėti sesiją <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>

        <div className="mt-20 grid gap-6 sm:grid-cols-3 text-left">
          {[
            { icon: Brain, title: "Emocinė analizė", desc: "Nustato krūvį nuo −10 iki +10 ir dominuojančią emociją." },
            { icon: Target, title: "Forma A / B & stulpelis", desc: "Parenka teisingą formą ir stulpelį iš 14 galimų." },
            { icon: Mic, title: "Balso įvestis", desc: "Įrašykite sesiją balsu — transkribuosime automatiškai." },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="rounded-xl border bg-card p-6 shadow-sm">
              <Icon className="h-6 w-6 text-primary" />
              <h3 className="mt-3 font-semibold">{title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{desc}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
