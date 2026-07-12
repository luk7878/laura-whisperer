import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { AI_GATEWAY_URL, requireLovableApiKey } from "@/lib/ai-gateway.server";
import { buildUserValueContext } from "@/lib/value-context.server";
import type { Database } from "@/integrations/supabase/types";

type Category = "be" | "do" | "have";
type VisionInput = { category: Category; content: string; why?: string; evidence?: string };
type Alignment = { category: Category; value_names: string[]; rationale: string };

export const Route = createFileRoute("/api/vision-alignment")({
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

        const supabase = createClient<Database>(url, anon, {
          global: { headers: { Authorization: `Bearer ${token}` } },
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { data: userData } = await supabase.auth.getUser(token);
        if (!userData.user) return new Response("Unauthorized", { status: 401 });

        const body = (await request.json()) as { vision?: VisionInput[] };
        const vision = Array.isArray(body.vision)
          ? body.vision
              .filter(
                (item): item is VisionInput =>
                  ["be", "do", "have"].includes(item?.category) && !!item?.content?.trim(),
              )
              .slice(0, 3)
          : [];
        if (!vision.length) return Response.json({ alignments: [], reflection: null });

        const context = await buildUserValueContext(
          supabase,
          vision.map((item) => item.content).join(" "),
        );
        if (!context.values.length) {
          return Response.json({ alignments: [], reflection: null });
        }

        const allowedNames = new Set(context.values.map((value) => value.name));
        const key = requireLovableApiKey();
        const upstream = await fetch(`${AI_GATEWAY_URL}/chat/completions`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            stream: false,
            temperature: 0.15,
            messages: [
              {
                role: "system",
                content: `Tu analizuoji Būti–Daryti–Turėti viziją pagal vartotojo realiai nustatytas TOP vertybes ir jų elgesio įrodymus.
Grąžink tik JSON:
{"alignments":[{"category":"be|do|have","value_names":["tikslus TOP vertybės pavadinimas"],"rationale":"1 konkretus sakinys"}],"reflection":{"category":"have","observation":"neutrali konkreti įtampa","question":"vienas atviras refleksijos klausimas"}|null}
Taisyklės:
- Kiekvienai pateiktai kategorijai parink 1–4 tiksliai iš konteksto nukopijuotus vertybių pavadinimus.
- Pagrindimą grįsk vizijos tekstu ir, jei įmanoma, vertybės įrodymais. Neišgalvok faktų.
- Refleksiją kurk tik esant prasmingam neatitikimui. Materialūs rezultatai gali būti priemonė vertybei, todėl klausk, o ne teisk.
- Neteik diagnozės ir neteigk, kad vizija klaidinga.
${context.prompt}`,
              },
              { role: "user", content: JSON.stringify(vision) },
            ],
          }),
        });
        if (!upstream.ok) return new Response(await upstream.text(), { status: upstream.status });
        const json = (await upstream.json()) as { choices?: { message?: { content?: string } }[] };
        const raw = json.choices?.[0]?.message?.content?.replace(/```json|```/g, "").trim();
        if (!raw) return Response.json({ alignments: [], reflection: null });
        const parsed = JSON.parse(raw) as {
          alignments?: Alignment[];
          reflection?: { category?: string; observation?: string; question?: string } | null;
        };
        const alignments = (parsed.alignments ?? [])
          .filter((item) => ["be", "do", "have"].includes(item.category))
          .map((item) => ({
            category: item.category,
            value_names: (item.value_names ?? [])
              .filter((name) => allowedNames.has(name))
              .slice(0, 4),
            rationale: String(item.rationale ?? "").slice(0, 500),
          }));
        const reflection =
          parsed.reflection?.question && parsed.reflection?.observation
            ? {
                category: parsed.reflection.category,
                observation: parsed.reflection.observation.slice(0, 500),
                question: parsed.reflection.question.slice(0, 500),
              }
            : null;
        return Response.json({ alignments, reflection });
      },
    },
  },
});
