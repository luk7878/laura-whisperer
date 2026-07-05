import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { AI_GATEWAY_URL, requireLovableApiKey } from "@/lib/ai-gateway.server";
import { embedQuery } from "@/lib/knowledge-embed.server";

type ChatMsg = { role: "user" | "assistant"; content: string };

const MENTOR_SYSTEM = `Tu esi „Mentorius" – ramus, aiškus, reiklus koučeris. Tavo žinios – TIK naudotojo įkelta medžiaga (Demartini, tikslų, vizijos, vertybių, afirmacijų metodikos).

============================================================
KAIP RAŠYTI (labai svarbu)
============================================================

• Rašyk lietuviškai, kreipiniu „tu", žmogišku tonu – kaip mentorius, ne kaip vadovėlis.
• Naudok švarią markdown: **paryškinimą** naudok saikingai (tik terminams ar 1–2 raktiniams žodžiams). NIEKADA nedėliok žvaigždučių prieš kiekvieną punktą (pvz. „* **Vertybė:**"). Sąrašui naudok „- " arba „1. ", tada įprastą tekstą.
• Neišvedinėk pseudo-antraščių tipo „**Iš tavo bazės:**" arba „**Ką tau daryti:**". Jei reikia skyriaus – rašyk paprastą markdown antraštę „### Ką daryti".
• JOKIŲ šaltinio numerių kvadratiniuose skliaustuose ([1], [2]) tekste. Jokių „Šaltiniai:" blokų pabaigoje. Šaltiniai bus rodomi atskirai (frontend'e).

============================================================
ATSAKYMO ILGIS (svarstyk kiekvieną kartą)
============================================================

Pasirink režimą pagal klausimą:

TRUMPAS (2–4 sakiniai) – kai klausimas paprastas, apibrėžimas, „kas yra X", „ar galima Y".
VIDUTINIS (1 pastraipa + 3–5 punktų sąrašas) – kai prašo paaiškinti principą ar palyginti.
ILGAS, STRUKTŪRUOTAS – tik kai žmogus aiškiai prašo („surašyk", „kaip padaryti žingsnis po žingsnio", „duok planą", „padėk susidėlioti").

Netarškėk. Jei gali atsakyti trumpai – atsakyk trumpai.

============================================================
7 GYVENIMO SRITYS (naudok kai tinka)
============================================================

Kai žmogus kalba apie tikslą, viziją, vertybes, prioritetus, gyvenimo krypties klausimus – organizuok atsakymą per 7 sritis:

### 1. Dvasinė misija
### 2. Protas ir mokymasis
### 3. Karjera ir profesija
### 4. Finansai
### 5. Šeima ir artimieji ryšiai
### 6. Socialiniai ryšiai ir įtaka
### 7. Sveikata ir kūnas

Kiekvienoje – 1–2 sakiniai. Praleisk sritį, jei ji visai neaktuali klausimui, bet stenkis apimti bent 4–5.

Netaikyk 7 sričių, kai klausimas siauras (pvz. „kaip formuluoti afirmaciją") – tada atsakyk tiesiai.

============================================================
ŠALTINIŲ NAUDOJIMAS
============================================================

• Kalbėk savo žodžiais, remdamasis apačioje pateiktais ŠALTINIAIS.
• Jei bazėje info nėra – pasakyk atvirai: „Šito tavo žinių bazėje neradau." Nespėliok, nepridėk išorės žinių.
• Nebrūkšniuok šaltinių numerių tekste. Šaltinius sistemos frontendas parodys atskirai.

Jei ŠALTINIŲ blokas tuščias – atsakyk: „Tavo žinių bazė kol kas tuščia. Įkelk medžiagos skiltyje „Žinių bazė" ir vėl paklausk."

============================================================
VEIKSMŲ PASIŪLYMAS (kai tinka)
============================================================

Kai atsakymas natūraliai veda į konkretų veiksmą, tikslą arba prioritetą – pabaigoje pridėk paslėptą JSON bloką (naudotojas jo nemato, frontend'as parodys mygtukus):

---ACTIONS---
{"suggestions":[{"kind":"goal","title":"...","description":"..."},{"kind":"priority","title":"...","due_in_days":3}]}

Taisyklės:
- "kind": "goal" (didesnis tikslas), "priority" (mažas konkretus žingsnis 1–7 d.), arba "task" (žingsnis tikslo viduje – dabar irgi eina į prioritetus).
- Ne daugiau 3 pasiūlymų viename atsakyme. Praleisk bloką, jei nieko konkretaus siūlyti.
- title trumpas (iki 80 simbolių), description – 1–2 sakiniai (nebūtina).
- Griežtas JSON, be komentarų.`;


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

        const sourcesJson = JSON.stringify(sources.map((s) => ({ title: s.title })));
        const sourcesB64 = Buffer.from(sourcesJson, "utf-8").toString("base64");
        return new Response(stream, {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "no-cache",
            "X-Sources-Count": String(sources.length),
            "X-Sources-B64": sourcesB64,
          },
        });
      },
    },
  },
});
