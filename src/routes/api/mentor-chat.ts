import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { AI_GATEWAY_URL, requireLovableApiKey } from "@/lib/ai-gateway.server";
import { embedQuery } from "@/lib/knowledge-embed.server";

type ChatMsg = { role: "user" | "assistant"; content: string };

const MENTOR_SYSTEM = `Tu esi „Mentorius" – ramus, aiškus, reiklus koučeris, kurio žinias sudaro TIK naudotojo įkelta medžiaga (Demartini, tikslų nusistatymo, vizijos, vertybių, afirmacijų, metodikų knygos ir tekstai).

GRIEŽTOS TAISYKLĖS:
1. Atsakinėk lietuviškai, kreipiniu „tu", trumpai ir konkrečiai.
2. Naudok TIK apačioje pateiktą "ŠALTINIŲ" bloką. Nepridėk savo bendrų žinių.
3. Kiekvieną teiginį, kuris kyla iš šaltinio, pažymėk numeriu kvadratiniuose skliaustuose: [1], [2] – atitinkančiu šaltinio numerį apačioje.
4. Jei atsakymo šaltiniuose nėra arba jis tik iš dalies dengia klausimą – SĄŽININGAI pasakyk: „Šios info tavo žinių bazėje neradau" (arba „radau tik dalį – …"). Nespėliok.
5. Jei žmogus klausia „ką man daryti" – pirma pateik atsakymą iš šaltinių su citatomis, tada pasiūlyk 1–2 konkrečius mažus veiksmus, kylančius iš tų šaltinių.
6. Formatas: pirma tiesus atsakymas (2–5 sakiniai su [n] citatomis). Tada, jei tinka, „**Iš tavo bazės:**" – 1–3 trumpi tiesioginiai citatų fragmentai kabutėse su [n].
7. Pabaigoje visada nauja eilute: „*Šaltiniai:*" ir sunumeruotas sąrašas tik tų, kuriuos naudojai (pvz. „[1] Demartini – The Breakthrough Experience, sk. apie vertybes").

Jei ŠALTINIŲ blokas tuščias – atsakyk: „Tavo žinių bazė kol kas tuščia. Įkelk medžiagos skiltyje „Žinių bazė" ir vėl paklausk."`;

export const Route = createFileRoute("/api/mentor-chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = request.headers.get("authorization") ?? request.headers.get("Authorization");
        if (!auth || !auth.toLowerCase().startsWith("bearer ")) {
          return new Response("Unauthorized", { status: 401 });
        }
        const token = auth.slice(7).trim();

        const body = (await request.json()) as { messages?: ChatMsg[] };
        const messages = Array.isArray(body.messages) ? body.messages : [];
        const lastUser = [...messages].reverse().find((m) => m.role === "user");
        if (!lastUser) return new Response("Missing user message", { status: 400 });

        const url = process.env.SUPABASE_URL;
        const anon = process.env.SUPABASE_PUBLISHABLE_KEY;
        if (!url || !anon) return new Response("Server misconfigured", { status: 500 });

        const supabase = createClient(url, anon, {
          global: { headers: { Authorization: `Bearer ${token}` } },
          auth: { persistSession: false, autoRefreshToken: false },
        });

        // Build query from last user msg (+ trailing 1 user context for follow-ups)
        const query = lastUser.content.slice(0, 2000);
        let sources: { n: number; title: string; content: string; document_id: string }[] = [];
        try {
          const qvec = await embedQuery(query);
          const { data, error } = await supabase.rpc("match_knowledge", {
            query_embedding: JSON.stringify(qvec),
            match_count: 6,
          });
          if (error) {
            console.error("match_knowledge failed", error);
          } else if (Array.isArray(data)) {
            sources = data.map((r: { document_id: string; document_title: string; content: string }, i: number) => ({
              n: i + 1,
              title: r.document_title,
              content: r.content,
              document_id: r.document_id,
            }));
          }
        } catch (e) {
          console.error("embed/search failed", e);
        }

        const sourcesBlock = sources.length
          ? sources
              .map(
                (s) =>
                  `[${s.n}] ${s.title}\n"""\n${s.content.slice(0, 1400)}\n"""`,
              )
              .join("\n\n")
          : "(žinių bazė tuščia)";

        const systemWithSources = `${MENTOR_SYSTEM}\n\n=== ŠALTINIAI ===\n${sourcesBlock}\n=== ŠALTINIŲ PABAIGA ===`;

        const key = requireLovableApiKey();
        const upstream = await fetch(`${AI_GATEWAY_URL}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${key}`,
          },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            stream: true,
            messages: [
              { role: "system", content: systemWithSources },
              ...messages,
            ],
          }),
        });

        if (!upstream.ok || !upstream.body) {
          const text = await upstream.text().catch(() => "");
          return new Response(text || "AI error", { status: upstream.status });
        }

        const encoder = new TextEncoder();
        const decoder = new TextDecoder();
        const reader = upstream.body.getReader();
        const stream = new ReadableStream({
          async start(controller) {
            let buffer = "";
            try {
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n");
                buffer = lines.pop() ?? "";
                for (const line of lines) {
                  const trimmed = line.trim();
                  if (!trimmed.startsWith("data:")) continue;
                  const data = trimmed.slice(5).trim();
                  if (data === "[DONE]") continue;
                  try {
                    const json = JSON.parse(data);
                    const delta = json.choices?.[0]?.delta?.content;
                    if (delta) controller.enqueue(encoder.encode(delta));
                  } catch {
                    // skip
                  }
                }
              }
              controller.close();
            } catch (e) {
              controller.error(e);
            }
          },
        });

        return new Response(stream, {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "no-cache",
            "X-Sources-Count": String(sources.length),
          },
        });
      },
    },
  },
});
