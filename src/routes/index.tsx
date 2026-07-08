import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Sparkles, HeartHandshake, Compass, Leaf } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Nemokama aiškumo sesija — kai galvoje per daug" },
      {
        name: "description",
        content:
          "15 minučių virtualus pokalbis, kuris padeda pamatyti tai, kas iš tikrųjų slegia, ir išeiti su vienu aiškiu žingsniu.",
      },
      { property: "og:title", content: "Nemokama aiškumo sesija — 15 min pokalbis" },
      {
        property: "og:description",
        content: "Papasakok, kas slegia — mentorius padės pamatyti aiškiau per 15 minučių.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://mentor.lauraborusaite.lt/" },
    ],
    links: [{ rel: "canonical", href: "https://mentor.lauraborusaite.lt/" }],
  }),

  component: Landing,
});

function Landing() {
  return (
    <div className="clarity-scope min-h-screen">
      <Nav />
      <Hero />
      <HowItWorks />
      <ForWhom />
      <Faq />
      <Footer />
    </div>
  );
}

function Nav() {
  return (
    <nav className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
      <div className="flex items-center gap-2">
        <span className="font-clarity-serif text-xl">Aiškumo sesija</span>
      </div>
      <div className="flex items-center gap-2 text-sm">
        <Link
          to="/auth"
          className="rounded-full px-4 py-2 text-clarity-ink-soft hover:text-clarity-ink transition-colors"
        >
          Prisijungti
        </Link>
        <Link
          to="/rezervacija"
          className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-clarity-ink px-5 py-2 text-clarity-bg hover:bg-clarity-ink-soft transition-colors"
        >
          Rezervuoti
        </Link>
      </div>
    </nav>
  );
}

function Hero() {
  return (
    <section className="mx-auto max-w-4xl px-6 pt-16 pb-24 text-center">
      <div className="inline-flex items-center gap-2 rounded-full border border-clarity-line bg-clarity-surface/60 px-4 py-1.5 text-xs text-clarity-ink-soft">
        <Sparkles className="h-3.5 w-3.5" />
        Nemokama · 15 minučių · Be paskyros
      </div>
      <h1 className="mt-8 font-clarity-serif text-5xl sm:text-6xl md:text-7xl leading-[1.05] tracking-tight text-clarity-ink">
        Kai galvoje per daug,
        <br />
        <span className="italic text-clarity-terra">o aiškumo mažai</span>
      </h1>
      <p className="mx-auto mt-8 max-w-2xl text-lg text-clarity-ink-soft leading-relaxed">
        Aprašyk, kas šiuo metu slegia. Virtualus mentorius užduos kelis tikslius klausimus, kad
        pamatytum situaciją aiškiau — ir išeitum su vienu konkrečiu žingsniu.
      </p>
      <div className="mt-10 flex flex-col items-center gap-3">
        <Link
          to="/rezervacija"
          className="group inline-flex items-center gap-2 rounded-full bg-clarity-terra px-8 py-4 text-lg text-white shadow-lg shadow-clarity-terra/20 hover:bg-clarity-ink transition-all hover:shadow-xl"
        >
          Rezervuoti nemokamą sesiją
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
        </Link>
        <p className="text-xs text-clarity-ink-soft/70">
          Nereikia registruotis · Nereikia mokėjimo · Konfidencialu
        </p>
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    {
      n: "01",
      title: "Papasakok, kas slegia",
      body: "Trumpas aprašymas rezervacijos formoje — tiek, kiek nori atskleisti. Nereikia sudėtingų žodžių.",
    },
    {
      n: "02",
      title: "Mentorius užduos tikslius klausimus",
      body: "Ne patarimų sąrašas. Klausimai, kurie padeda pamatyti tai, ko iki šiol nematei.",
    },
    {
      n: "03",
      title: "Išeini su vienu aiškiu žingsniu",
      body: "Sesijos pabaigoje — santrauka: pagrindinė tema, naujas suvokimas ir vienas veiksmas šiai savaitei.",
    },
  ];
  return (
    <section className="border-y border-clarity-line bg-clarity-surface/40 py-24">
      <div className="mx-auto max-w-5xl px-6">
        <h2 className="text-center font-clarity-serif text-4xl text-clarity-ink">Kaip tai vyksta</h2>
        <p className="mx-auto mt-4 max-w-xl text-center text-clarity-ink-soft">
          Trys žingsniai. Iš viso apie 15 minučių tavo laiko.
        </p>
        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {steps.map((s) => (
            <div key={s.n} className="rounded-2xl bg-clarity-bg p-8 shadow-sm border border-clarity-line">
              <div className="font-clarity-serif text-2xl text-clarity-terra">{s.n}</div>
              <h3 className="mt-3 font-clarity-serif text-2xl text-clarity-ink">{s.title}</h3>
              <p className="mt-3 text-clarity-ink-soft leading-relaxed">{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ForWhom() {
  const cases = [
    { icon: HeartHandshake, title: "Santykių sunkumai", body: "Užstrigo pokalbis su artimu žmogumi. Nesupranti, ko iš tikrųjų nori pati/-s." },
    { icon: Compass, title: "Karjeros kryžkelė", body: "Reikia priimti sprendimą, bet visos pusės atrodo blogai. Neaišku, kas iš tikrųjų svarbu." },
    { icon: Leaf, title: "Per didelis krūvis", body: "Diena baigėsi, o galvoje viskas kunkuliuoja. Nori bent minutę tylos ir aiškumo." },
    { icon: Sparkles, title: "Savivertė", body: "Vidinis balsas per griežtas. Nori pamatyti save švelniau, be sacharino." },
  ];
  return (
    <section className="py-24">
      <div className="mx-auto max-w-5xl px-6">
        <h2 className="text-center font-clarity-serif text-4xl text-clarity-ink">Kam tai</h2>
        <p className="mx-auto mt-4 max-w-xl text-center text-clarity-ink-soft">
          Nebūtinai turi būti krizė. Užtenka to, kad kažkas nusėda nemaloniai.
        </p>
        <div className="mt-14 grid gap-6 sm:grid-cols-2">
          {cases.map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-2xl border border-clarity-line bg-clarity-bg p-8">
              <Icon className="h-6 w-6 text-clarity-terra" />
              <h3 className="mt-4 font-clarity-serif text-2xl text-clarity-ink">{title}</h3>
              <p className="mt-2 text-clarity-ink-soft leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}


function Faq() {
  const items = [
    { q: "Ar tikrai nemokama?", a: "Taip. Pirma sesija — 15 minučių — nemokama, be įsipareigojimų. Nereikia įvesti kortelės." },
    { q: "Ar galiu būti anonimiškai?", a: "Vardas nebūtinai turi būti tikras. Reikia el. pašto, kad galėtume atsiųsti sesijos nuorodą." },
    { q: "Kas tas virtualus mentorius?", a: "Dirbtinio intelekto asistentas, sukurtas remiantis giluminės savirefleksijos ir sąmoningumo principais. Ne terapeutas ir ne draugas — struktūruotas klausimų tinklas." },
    { q: "Kas nutinka su tuo, ką parašau?", a: "Tavo pokalbis saugomas šifruotai ir naudojamas tik tam, kad mentorius atsimintų kontekstą sesijos metu. Duomenys nedalinami tretiesiems asmenims." },
    { q: "O jei bus per sunku?", a: "Jei mentorius atpažįsta, kad tema per sunki AI pokalbiui, jis pasiūlys tęsti su tikru žmogumi." },
  ];
  return (
    <section className="py-24">
      <div className="mx-auto max-w-2xl px-6">
        <h2 className="text-center font-clarity-serif text-4xl text-clarity-ink">Dažni klausimai</h2>
        <div className="mt-12 space-y-6">
          {items.map((it) => (
            <details key={it.q} className="group rounded-2xl border border-clarity-line bg-clarity-bg p-6 open:bg-clarity-surface/40 transition-colors">
              <summary className="cursor-pointer list-none font-clarity-serif text-lg text-clarity-ink flex items-center justify-between">
                {it.q}
                <span className="ml-4 text-clarity-terra transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 text-clarity-ink-soft leading-relaxed">{it.a}</p>
            </details>
          ))}
        </div>
        <div className="mt-16 text-center">
          <Link
            to="/rezervacija"
            className="inline-flex items-center gap-2 rounded-full bg-clarity-terra px-8 py-4 text-lg text-white hover:bg-clarity-ink transition-colors"
          >
            Rezervuoti nemokamą sesiją <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-clarity-line py-10">
      <div className="mx-auto max-w-5xl px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-clarity-ink-soft">
        <span className="font-clarity-serif text-lg text-clarity-ink">Aiškumo sesija</span>
        <span>© {new Date().getFullYear()} · Konfidencialu · Ne terapija</span>
      </div>
    </footer>
  );
}
