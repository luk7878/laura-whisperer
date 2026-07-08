import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { AI_GATEWAY_URL, requireLovableApiKey } from "@/lib/ai-gateway.server";

const bodySchema = z.object({
  token: z.string().uuid(),
  emotional_end: z.number().int().min(1).max(10).optional().nullable(),
  feedback: z.string().trim().max(1000).optional().nullable(),
  helpfulness_rating: z.number().int().min(1).max(5).optional().nullable(),
  phone: z.string().trim().max(50).optional().nullable(),
  contact_email: z.string().trim().email().max(255).optional().nullable(),
});

const SUMMARY_PROMPT = `Iš pokalbio ištrauk trumpą santrauką. Grąžink TIK JSON objektą su laukais:
{
  "topic": "1 sakinys apie pagrindinę temą",
  "insight": "1–2 sakiniai apie naują suvokimą, kurį žmogus atrado",
  "action": "vienas konkretus veiksmas šiai savaitei (1 sakinys)",
  "next_step": "švelnus pasiūlymas, ką daryti toliau (1 sakinys)"
}
Jokio papildomo teksto, jokių kodo blokų. Lietuvių kalba.`;

export const Route = createFileRoute("/api/public/clarity/finish")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let raw: unknown;
        try { raw = await request.json(); } catch { return new Response("Invalid JSON", { status: 400 }); }
        const parsed = bodySchema.safeParse(raw);
        if (!parsed.success) return new Response("Netinkami duomenys", { status: 400 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: booking } = await supabaseAdmin
          .from("clarity_bookings")
          .select("id, summary")
          .eq("access_token", parsed.data.token)
          .maybeSingle();
        if (!booking) return new Response("Booking not found", { status: 404 });

        const { data: history } = await supabaseAdmin
          .from("clarity_messages")
          .select("role, content")
          .eq("booking_id", booking.id)
          .order("created_at", { ascending: true });

        // Generate summary only if not already generated
        let summary = booking.summary as Record<string, string> | null;
        if (!summary && history && history.length > 0) {
          const key = requireLovableApiKey();
          const upstream = await fetch(`${AI_GATEWAY_URL}/chat/completions`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash",
              stream: false,
              messages: [
                { role: "system", content: SUMMARY_PROMPT },
                {
                  role: "user",
                  content:
                    "Pokalbio istorija:\n\n" +
                    history.map((m) => `${m.role === "user" ? "Žmogus" : "Mentorius"}: ${m.content}`).join("\n\n"),
                },
              ],
            }),
          });
          if (upstream.ok) {
            const aiJson = (await upstream.json()) as { choices?: { message?: { content?: string } }[] };
            const raw = aiJson.choices?.[0]?.message?.content?.trim() ?? "";
            const cleaned = raw.replace(/```json|```/gi, "").trim();
            try {
              summary = JSON.parse(cleaned);
            } catch {
              summary = { topic: "", insight: cleaned.slice(0, 400), action: "", next_step: "" };
            }
          }
        }

        await supabaseAdmin
          .from("clarity_bookings")
          .update({
            status: "completed",
            completed_at: new Date().toISOString(),
            emotional_end: parsed.data.emotional_end ?? undefined,
            feedback: parsed.data.feedback ?? undefined,
            summary: summary ?? undefined,
          })
          .eq("id", booking.id);

        return Response.json({ summary });
      },
    },
  },
});
