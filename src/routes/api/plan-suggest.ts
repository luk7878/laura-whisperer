import { createFileRoute } from "@tanstack/react-router";
import { AI_GATEWAY_URL, requireLovableApiKey } from "@/lib/ai-gateway.server";

type ChatMsg = { role: "user" | "assistant"; content: string };

type Body = {
  messages?: ChatMsg[];
  topic?: string | null;
  belief?: string | null;
  column?: string | null;
  emotion?: number | null;
  patterns?: string[] | null;
};

const SYSTEM_PROMPT = `Tu esi Demartini metodo vedlys. Tavo užduotis – iš vykusios savirefleksijos sesijos ištraukti KONKRETŲ, subalansuotą veiksmų planą, ne pažadų sąrašą.

Grąžink TIK JSON pagal šią schemą, be jokio papildomo teksto:
{
  "plan_title": "trumpas, konkretus (max 60 simb.)",
  "plan_summary": "1–2 sakiniai – kas šioje sesijoje paaiškėjo ir kodėl būtent šie veiksmai",
  "goal_title": "aiškus tikslas, kylantis iš įžvalgos (max 70 simb.)",
  "goal_description": "kaip atrodys, kai bus pasiekta – matomas, jautriamas rezultatas (2–4 sakiniai)",
  "goal_target_days": 30,
  "experiment": {
    "hypothesis": "jei atliksiu konkretų veiksmą, pastebėsiu konkretų pokytį",
    "action": "vienas mažas veiksmas",
    "observable_behavior": "ką objektyviai stebėsiu",
    "success_criterion": "konkretus sėkmės slenkstis",
    "duration_days": 5
  },
  "steps": [
    {
      "title": "veiksmažodžiu pradedantis, konkretus, matuojamas (max 80 simb.)",
      "why": "kaip šis žingsnis integruoja įžvalgą į kasdienybę (1 sakinys)",
      "due_in_days": 3,
      "as_priority": true
    }
  ]
}

Griežtos taisyklės:
- 2–5 žingsniai, ne daugiau. Kokybė > kiekybė.
- Kiekvienas žingsnis prasideda veiksmažodžiu (parašyti, paskambinti, pasakyti, susitikti, pasidėti į kalendorių...).
- NE bendrybės ("dirbti su savimi", "būti dėkingam"). Visada konkretus veiksmas su matomu rezultatu.
- 1–2 žingsniai su as_priority=true (artimiausi, kritiniai). Kiti – palaikomieji.
- due_in_days: pirmas žingsnis dažniausiai 1–3 d. Nė vienas > 30 d.
- Jei sesijos temoje buvo konkretus žmogus – bent vienas žingsnis liečia santykį su juo (padėka, pokalbis, atsiprašymas, ribos).
- Eksperimentas trunka 3–7 dienas, yra saugus ir lengvai atšaukiamas.
- Hipotezė turi būti patikrinama, veiksmas – vienas, o sėkmės kriterijus – konkretus.
- Stebimas elgesys negali remtis vien savijauta: įvardyk veiksmą, dažnį, laiką ar rezultatą.
- Kalba lietuvių, kreipinys „tu".`;

export const Route = createFileRoute("/api/plan-suggest")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json()) as Body;
        const messages = Array.isArray(body.messages) ? body.messages.slice(-30) : [];
        if (messages.length === 0) {
          return new Response("Missing messages", { status: 400 });
        }

        const contextLines: string[] = [];
        if (body.topic) contextLines.push(`Tema: ${body.topic}`);
        if (body.belief) contextLines.push(`Įsitikinimas: ${body.belief}`);
        if (body.column) contextLines.push(`Aktyvus stulpelis: ${body.column}`);
        if (typeof body.emotion === "number")
          contextLines.push(`Emocinis krūvis (dabar): ${body.emotion}/10`);
        if (body.patterns && body.patterns.length)
          contextLines.push(`Modeliai: ${body.patterns.join(", ")}`);

        const transcript = messages
          .map((m) => `${m.role === "user" ? "Klientas" : "Vedlys"}: ${m.content}`)
          .join("\n\n");

        const userPrompt = `${contextLines.length ? `Sesijos kontekstas:\n${contextLines.join("\n")}\n\n` : ""}Sesijos pokalbis:\n${transcript}\n\nSukurk veiksmų plano juodraštį pagal schemą.`;

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

        // Try direct parse; strip code fences if present
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
