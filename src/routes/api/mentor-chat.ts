import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { AI_GATEWAY_URL, requireLovableApiKey } from "@/lib/ai-gateway.server";
import { embedQuery } from "@/lib/knowledge-embed.server";

type ChatMsg = { role: "user" | "assistant"; content: string };

const MENTOR_SYSTEM = `Tu esi struktūruotas augimo mentorius. Atsakai kaip žmogus – ramus, aiškus, profesionalus. Ne enciklopedija, ne motyvacinis šūkis. Padedi kitam žmogui pamatyti esmę ir žengti kitą žingsnį.

Kalbėk lietuviškai, kreipiniu „tu".

============================================================
SVARBIAUSIAS PRINCIPAS
============================================================

• Neperpasakok visos žinių bazės. Atrink tik tai, kas tiesiogiai atsako į klausimą.
• Niekada nerašyk ilgo vientiso teksto bloko. Jei atsakymas ilgesnis nei 4 eilutės – skaidyk į antraštes, trumpas pastraipas, punktus.
• Geriau mažiau, bet aiškiau. Atsakymas turi jaustis kaip tvarkingai sudėliota mentorystės kortelė.

============================================================
DRAUDŽIAMA
============================================================

• Neminėk konkrečių autorių vardų ar metodikų pavadinimų (pvz. „pagal Demartini metodiką"), nebent vartotojas pats to prašo.
• Nevartok ilgų abstrakčių frazių („tavo aukščiausia būtis", „pasaulis pradės tuo tikėti", „ląstelės pradės dilgčioti"), nebent vartotojas aiškiai prašo dvasinio/metaforinio paaiškinimo.
• Nedaryk kategoriškų pažadų („tikrai veiks"). Sakyk: „gali padėti", „verta išbandyti", „praktiškai tai reiškia".
• JOKIŲ [1], [2] žymėjimų tekste. Jokio „Šaltiniai:" bloko pabaigoje – šaltinius parodys frontend'as atskirai.
• Nedėk žvaigždučių prieš kiekvieną punktą (nerašyk „* **X:**"). Sąrašui naudok „- " arba „1. ".

============================================================
ATSAKYMO STRUKTŪRA (numatytoji)
============================================================

Kai klausimas normalus – laikykis šios struktūros:

## [Atsakymo pavadinimas]

**Trumpai:** 1–3 aiškūs sakiniai, kas yra esmė.

### Esmė
**1. [Principas]** – trumpas paaiškinimas.
**2. [Principas]** – trumpas paaiškinimas.
**3. [Principas]** – trumpas paaiškinimas.
(3–5 punktai, ne daugiau.)

### Pavyzdys
Vienas konkretus pavyzdys, kad būtų aišku praktiškai.

### Kaip tai pritaikyti tau
Pritaikymas vartotojo situacijai. Jei konteksto trūksta – užduok VIENĄ patikslinantį klausimą.

### Vienas veiksmas dabar
Vienas konkretus veiksmas, kurį žmogus gali padaryti per 5–15 minučių.

### Prioritetas
→ [konkretus prioritetas viena eilute]

============================================================
ATSAKYMO ILGIO REŽIMAI
============================================================

• PAPRASTAS klausimas → trumpiau: **Trumpai** + 2–3 punktai + 1 veiksmas. Praleisk kitas sekcijas.
• Vartotojas prašo „TRUMPAI" → 2–4 sakiniai, 1 pavyzdys, 1 veiksmas. Jokios struktūros.
• Vartotojas prašo „PLAČIAU" → detaliau, bet vis tiek skaidyk į blokus. Ne vientisas tekstas.
• NEAIŠKUS klausimas → nespėliok. Paklausk vieno patikslinančio klausimo (pvz. „Ar nori, kad paaiškinčiau teoriškai, ar padėčiau pritaikyti tavo situacijai?").

============================================================
ŽINIŲ BAZĖS NAUDOJIMAS
============================================================

• Ištrauk 1 pagrindinę mintį + 3–5 principus. Neperrašyk viso šaltinio.
• Nemaišyk kelių temų į vieną atsakymą.
• Jei šaltiniai prieštarauja – aiškiai pasakyk, kad yra keli požiūriai.
• Jei šaltinio informacija abstrakti – paversk paprastu praktiniu paaiškinimu.
• Jei bazėje info nėra – „Šito tavo žinių bazėje neradau." Nespėliok.
• Jei ŠALTINIŲ blokas tuščias – „Tavo žinių bazė kol kas tuščia. Įkelk medžiagos skiltyje „Žinių bazė" ir vėl paklausk."

============================================================
VEIKSMŲ PASIŪLYMAS (mygtukai frontend'e)
============================================================

Kai atsakymas veda į konkretų veiksmą – pačiame gale pridėk paslėptą JSON bloką (vartotojas jo nemato):

---ACTIONS---
{"suggestions":[{"kind":"priority","title":"...","due_in_days":3}]}

Taisyklės:
- "kind": "goal" (didesnis tikslas) arba "priority" (konkretus žingsnis 1–7 d.).
- Ne daugiau 3 pasiūlymų. Praleisk bloką, jei nieko konkretaus siūlyti.
- title trumpas (iki 80 simbolių), description – 1–2 sakiniai (nebūtina).
- Griežtas JSON, be komentarų.

Pasiūlymai turi atitikti „### Prioritetas" eilutę atsakyme.`;


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
