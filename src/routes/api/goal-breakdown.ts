import { createFileRoute } from "@tanstack/react-router";
import { AI_GATEWAY_URL, requireLovableApiKey } from "@/lib/ai-gateway.server";

type Body = {
  goal_title?: string;
  goal_description?: string | null;
  why?: string | null;
  value?: string | null;
  benefits?: string | null;
  costs?: string | null;
  obstacles?: string | null;
  first_step?: string | null;
  target_date?: string | null;
};

const SYSTEM_PROMPT = `Tu esi vykdymo strategas Demartini dvasioje. Iš išgryninto tikslo pastatai HIERARCHINĮ užduočių medį, kuris žmogų realiai atveda iki rezultato – ne pažadų sąrašas, o įvykdomas planas.

Grąžink TIK JSON pagal šią schemą, be jokio papildomo teksto:
{
  "milestones": [
    {
      "title": "etapo pavadinimas – aiškus tarpinis rezultatas (max 80 simb.)",
      "why": "kodėl šis etapas būtinas kelyje į tikslą (1 sakinys)",
      "estimate": "trumpas laiko įvertis, pvz. '1 sav.', '3 d.', '2 val.'",
      "due_in_days": 7,
      "subtasks": [
        {
          "title": "konkreti užduotis, prasideda veiksmažodžiu (max 80 simb.)",
          "why": "kaip ši užduotis pastumia etapą (1 sakinys, neprivaloma)",
          "estimate": "pvz. '2 val.', '1 d.'",
          "due_in_days": 2,
          "subtasks": [
            { "title": "labai konkretus mikro veiksmas, jei reikia dar smulkiau" }
          ]
        }
      ]
    }
  ]
}

Griežtos taisyklės:
- 3–6 pagrindiniai etapai (milestones). Loginė seka nuo dabar iki tikslo.
- Kiekvienas etapas turi 2–6 subtasks. Sub-užduočių pavadinimai prasideda veiksmažodžiu (parašyti, paskambinti, sukurti, susitikti, ištirti, nupirkti, publikuoti...).
- Jei sub-užduotis pati yra sudėtinga (pvz. „sukurti interneto puslapį", „paruošti pristatymą", „susirasti klientą") – SKAIDYK ją į 2–5 mikro veiksmus per trečią lygį subtasks. Paprastas užduotis palik be trečio lygio.
- Maksimalus gylis – 3 lygiai (etapas → užduotis → mikro veiksmas).
- due_in_days atspindi tvarką: kiekvienas etapas prasideda po ankstesnio. Pirma savaite – parengiamieji, vėliau – kūrimas, gale – įtvirtinimas.
- NE bendrybės („dirbti su savimi", „planuoti", „galvoti"). Visada matoma pasekmė.
- Jei tiksle minimas konkretus žmogus, sritis ar įrankis – naudok jį tekste.
- Kalba lietuvių, kreipinys „tu", jokių emoji.`;

export const Route = createFileRoute("/api/goal-breakdown")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json()) as Body;
        if (!body.goal_title) {
          return new Response("Missing goal_title", { status: 400 });
        }

        const ctx: string[] = [`Tikslas: ${body.goal_title}`];
        if (body.goal_description) ctx.push(`Aprašymas: ${body.goal_description}`);
        if (body.why) ctx.push(`Kodėl: ${body.why}`);
        if (body.value) ctx.push(`Aukščiausia vertybė: ${body.value}`);
        if (body.benefits) ctx.push(`Nauda: ${body.benefits}`);
        if (body.costs) ctx.push(`Kaina: ${body.costs}`);
        if (body.obstacles) ctx.push(`Kliūtys: ${body.obstacles}`);
        if (body.first_step) ctx.push(`Pirmas žingsnis (jau sutartas): ${body.first_step}`);
        if (body.target_date) ctx.push(`Terminas: ${body.target_date}`);

        const userPrompt = `${ctx.join("\n")}\n\nSukurk hierarchinį užduočių medį pagal schemą, kuris realiai atves prie šio tikslo. Jei koks nors žingsnis sudėtingas – suskaidyk į mikro veiksmus.`;

        const key = requireLovableApiKey();
        const upstream = await fetch(`${AI_GATEWAY_URL}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${key}`,
          },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            response_format: { type: "json_object" },
            messages: [
              { role: "system", content: SYSTEM_PROMPT },
              { role: "user", content: userPrompt },
            ],
          }),
        });

        if (!upstream.ok) {
          const text = await upstream.text().catch(() => "");
          return new Response(text || "AI error", { status: upstream.status });
        }
        const json = (await upstream.json()) as {
          choices?: { message?: { content?: string } }[];
        };
        const content = json.choices?.[0]?.message?.content ?? "{}";

        let parsed: unknown = null;
        try {
          parsed = JSON.parse(content);
        } catch {
          const cleaned = content.replace(/```json|```/gi, "").trim();
          try {
            parsed = JSON.parse(cleaned);
          } catch {
            return new Response("AI returned invalid JSON", { status: 502 });
          }
        }

        return Response.json(parsed);
      },
    },
  },
});
