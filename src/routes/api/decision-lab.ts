import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { AI_GATEWAY_URL, requireLovableApiKey } from "@/lib/ai-gateway.server";
import { buildUserValueContext } from "@/lib/value-context.server";
import type { Database } from "@/integrations/supabase/types";

type OptionInput = { id: string; title: string };

export const Route = createFileRoute("/api/decision-lab")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = request.headers.get("authorization") ?? request.headers.get("Authorization");
        if (!auth?.toLowerCase().startsWith("bearer "))
          return new Response("Unauthorized", { status: 401 });
        const token = auth.slice(7).trim();
        const url = import.meta.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
        const anon =
          import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
        if (!url || !anon) return new Response("Server misconfigured", { status: 500 });
        const supabase = createClient<Database>(url, anon, {
          global: { headers: { Authorization: `Bearer ${token}` } },
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { data } = await supabase.auth.getUser(token);
        if (!data.user) return new Response("Unauthorized", { status: 401 });

        const body = (await request.json()) as { dilemma?: string; options?: OptionInput[] };
        const dilemma = String(body.dilemma ?? "")
          .trim()
          .slice(0, 1000);
        const options = Array.isArray(body.options)
          ? body.options
              .filter((option) => option?.id && option?.title?.trim())
              .slice(0, 4)
              .map((option) => ({
                id: String(option.id).slice(0, 60),
                title: option.title.trim().slice(0, 300),
              }))
          : [];
        if (!dilemma || options.length < 2)
          return new Response("Reikia dilemos ir bent dviejų variantų", { status: 400 });

        const valueContext = await buildUserValueContext(
          supabase,
          `${dilemma} ${options.map((option) => option.title).join(" ")}`,
        );
        const key = requireLovableApiKey();
        const upstream = await fetch(`${AI_GATEWAY_URL}/chat/completions`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            stream: false,
            temperature: 0.2,
            messages: [
              {
                role: "system",
                content: `Tu kuri neutralią sprendimo matricą. Niekada nepasakyk, kurį variantą rinktis. Parodyk abiejų pusių naudą, kainą ir prielaidas.
Grąžink tik JSON:
{"summary":"neutralus dilemos branduolys","criteria":["3–5 svarbiausi kriterijai"],"options":[{"id":"tikslus pateiktas id","value_fit":[{"value":"vertybė","fit":"high|medium|low","reason":"konkretus pagrindas"}],"short_benefits":["..."],"long_benefits":["..."],"costs":["..."],"idealization":"galimas vienpusiškumas arba null","devaluation":"kas galbūt nuvertinama arba null","external_expectations":"galimas svetimas lūkestis arba null","related_goals":["tik realiai kontekste esantys tikslai"],"reversibility":{"level":"high|medium|low","reason":"..."},"unknowns":["ką dar reikia patikrinti"]}],"tension":"pagrindinis vertybinis konfliktas arba null","experiment":{"title":"mažas grįžtamas bandymas","action":"konkretus veiksmas","duration_days":1-14,"success_signal":"ką stebėti","review_question":"vienas klausimas po eksperimento"}}
Taisyklės:
- Remkis vartotojo TOP vertybėmis, jų įrodymais ir pateiktais susijusiais tikslais. Neišgalvok tikslų ar faktų.
- Materialų rezultatą vertink ir kaip galimą priemonę kitai vertybei.
- Idealizavimą, nuvertinimą ir svetimą lūkestį formuluok kaip hipotezę, ne diagnozę.
- Eksperimentas turi būti saugus, mažas, pigus ir grįžtamas; jis turi suteikti naujų realių duomenų prieš galutinį sprendimą.
${valueContext.prompt}`,
              },
              { role: "user", content: JSON.stringify({ dilemma, options }) },
            ],
          }),
        });
        if (!upstream.ok) return new Response(await upstream.text(), { status: upstream.status });
        const json = (await upstream.json()) as { choices?: { message?: { content?: string } }[] };
        const raw = json.choices?.[0]?.message?.content?.replace(/```json|```/g, "").trim();
        if (!raw) return new Response("AI negrąžino analizės", { status: 502 });
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        return Response.json({ analysis: parsed });
      },
    },
  },
});
