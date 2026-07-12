import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { AI_GATEWAY_URL, requireLovableApiKey } from "@/lib/ai-gateway.server";

type ValueGroup = { name: string; evidence?: string[]; count?: number };
type Suggestion = {
  source: string;
  target: string;
  confidence: number;
  reason: string;
};

const SYSTEM = `Tu analizuoji žmogaus vertybių nustatymo pratimo rezultatus. Tavo užduotis – rasti tik tas grupes, kurios greičiausiai reiškia tą pačią gilesnę vertybę, nors pavadintos skirtingai.

Grąžink TIK JSON:
{"suggestions":[{"source":"tikslus vienos grupės pavadinimas","target":"tikslus kitos grupės pavadinimas","confidence":0.0,"reason":"vienas trumpas sakinys lietuviškai"}]}

Taisyklės:
- Pavadinimus kopijuok tiksliai iš pateikto sąrašo.
- Vertink ne tik žodžių panašumą, bet ir realius įrodymus.
- Nesiūlyk sujungti vien todėl, kad sritys susijusios. „Šeima“ ir „santykiai“ gali būti atskiros vertybės.
- Siūlyk tik kai tikimybė bent 0.68.
- source ir target negali sutapti.
- Kiekviena pora tik vieną kartą.
- Jei aiškaus sutapimo nėra, grąžink tuščią suggestions masyvą.
- Tai tik pasiūlymai žmogui; nepriimk sprendimo už jį.`;

export const Route = createFileRoute("/api/value-similarities")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = request.headers.get("authorization") ?? request.headers.get("Authorization");
        if (!auth?.toLowerCase().startsWith("bearer ")) {
          return new Response("Unauthorized", { status: 401 });
        }
        const token = auth.slice(7).trim();
        const url = import.meta.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
        const anon =
          import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
        if (!url || !anon) return new Response("Server misconfigured", { status: 500 });
        const supabase = createClient(url, anon, {
          global: { headers: { Authorization: `Bearer ${token}` } },
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { data: userData, error: userError } = await supabase.auth.getUser(token);
        if (userError || !userData.user) return new Response("Unauthorized", { status: 401 });

        const body = (await request.json()) as { values?: ValueGroup[] };
        const values = Array.isArray(body.values)
          ? body.values
              .filter((value) => typeof value?.name === "string" && value.name.trim())
              .slice(0, 20)
              .map((value) => ({
                name: value.name.trim().slice(0, 120),
                count: Number.isFinite(value.count) ? value.count : 0,
                evidence: Array.isArray(value.evidence)
                  ? value.evidence
                      .filter((item): item is string => typeof item === "string")
                      .slice(0, 4)
                      .map((item) => item.slice(0, 240))
                  : [],
              }))
          : [];
        if (values.length < 2) return Response.json({ suggestions: [] });

        const key = requireLovableApiKey();
        const upstream = await fetch(`${AI_GATEWAY_URL}/chat/completions`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            response_format: { type: "json_object" },
            temperature: 0,
            messages: [
              { role: "system", content: SYSTEM },
              { role: "user", content: JSON.stringify({ values }) },
            ],
          }),
        });
        if (!upstream.ok) {
          const text = await upstream.text().catch(() => "");
          return new Response(text || "AI error", { status: upstream.status });
        }
        const response = (await upstream.json()) as {
          choices?: { message?: { content?: string } }[];
        };
        const content = response.choices?.[0]?.message?.content ?? "{}";
        let parsed: { suggestions?: Suggestion[] } = {};
        try {
          parsed = JSON.parse(content.replace(/```json|```/gi, "").trim());
        } catch {
          return new Response("AI returned invalid JSON", { status: 502 });
        }
        const names = new Set(values.map((value) => value.name));
        const seen = new Set<string>();
        const suggestions = (Array.isArray(parsed.suggestions) ? parsed.suggestions : [])
          .filter(
            (item) =>
              names.has(item.source) &&
              names.has(item.target) &&
              item.source !== item.target &&
              Number(item.confidence) >= 0.68,
          )
          .filter((item) => {
            const key = [item.source, item.target].sort().join("\u0000");
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          })
          .slice(0, 6)
          .map((item) => ({
            source: item.source,
            target: item.target,
            confidence: Math.min(1, Math.max(0, Number(item.confidence))),
            reason: String(item.reason ?? "Panašūs pavadinimai ir įrodymai.").slice(0, 240),
          }));
        return Response.json({ suggestions });
      },
    },
  },
});
