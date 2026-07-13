import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { AI_GATEWAY_URL, requireLovableApiKey } from "@/lib/ai-gateway.server";
import type { Database } from "@/integrations/supabase/types";

export const Route = createFileRoute("/api/compass-recommendation")({
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
        const body = (await request.json()) as { snapshot?: unknown };
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
                content: `Tu esi asmeninio augimo kompasas. Iš pateiktos suvestinės pasiūlyk VIENĄ realistišką kitą žingsnį artimiausioms 24–72 valandoms.
Grąžink tik JSON: {"title":"iki 70 simbolių","reason":"1 konkretus sakinys","action":"vienas pamatuojamas veiksmas","destination":"/values|/session|/goals|/priorities|/vision|/progress"}.
Prioritetas: pirma saugumas ir emocinė įtampa, tada vėluojantis konkretus veiksmas, tada aktyvus tikslas, tada vertybių ar vizijos spraga. Neprikurk faktų. Neminiu metodikos ar autoriaus.`,
              },
              { role: "user", content: JSON.stringify(body.snapshot ?? {}) },
            ],
          }),
        });
        if (!upstream.ok) return new Response(await upstream.text(), { status: upstream.status });
        const json = (await upstream.json()) as { choices?: { message?: { content?: string } }[] };
        const raw = json.choices?.[0]?.message?.content?.replace(/```json|```/g, "").trim();
        if (!raw) return Response.json({ recommendation: null });
        const parsed = JSON.parse(raw) as Record<string, string>;
        const allowed = new Set([
          "/values",
          "/session",
          "/goals",
          "/priorities",
          "/vision",
          "/progress",
        ]);
        return Response.json({
          recommendation: {
            title: String(parsed.title ?? "Pasirink vieną kitą žingsnį").slice(0, 100),
            reason: String(parsed.reason ?? "").slice(0, 350),
            action: String(parsed.action ?? "").slice(0, 250),
            destination: allowed.has(parsed.destination) ? parsed.destination : "/priorities",
          },
        });
      },
    },
  },
});
