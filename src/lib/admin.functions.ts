import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { AI_GATEWAY_URL, requireLovableApiKey } from "@/lib/ai-gateway.server";

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin only");
}

export const listClarityBookings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("clarity_bookings")
      .select(
        "id, name, email, phone, contact_email, concern, status, scheduled_at, emotional_start, emotional_end, safety_triggered, safety_reason, summary, feedback, helpfulness_rating, wants_subscription, wants_human_session, human_session_requested_at, human_session_preferred_at, human_session_note, started_at, completed_at, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return { bookings: data ?? [] };
  });

const SUMMARY_PROMPT = `Iš pokalbio ištrauk trumpą santrauką. Grąžink TIK JSON objektą su laukais:
{
  "topic": "1 sakinys apie pagrindinę temą",
  "insight": "1–2 sakiniai apie naują suvokimą, kurį žmogus atrado",
  "action": "vienas konkretus veiksmas šiai savaitei (1 sakinys)",
  "next_step": "švelnus pasiūlymas, ką daryti toliau (1 sakinys)"
}
Jokio papildomo teksto, jokių kodo blokų. Lietuvių kalba.`;

export const generateBookingSummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ bookingId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: booking } = await supabaseAdmin
      .from("clarity_bookings")
      .select("id, summary")
      .eq("id", data.bookingId)
      .maybeSingle();
    if (!booking) throw new Error("Booking not found");

    const { data: history } = await supabaseAdmin
      .from("clarity_messages")
      .select("role, content")
      .eq("booking_id", booking.id)
      .order("created_at", { ascending: true });

    if (!history || history.length === 0) {
      throw new Error("Šis vartotojas neturi pokalbio žinučių");
    }

    const key = requireLovableApiKey();
    const upstream = await fetch(`${AI_GATEWAY_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        stream: false,
        messages: [
          { role: "system", content: SUMMARY_PROMPT },
          {
            role: "user",
            content:
              "Pokalbio istorija:\n\n" +
              history
                .map(
                  (m: { role: string; content: string }) =>
                    `${m.role === "user" ? "Žmogus" : "Mentorius"}: ${m.content}`,
                )
                .join("\n\n"),
          },
        ],
      }),
    });
    if (!upstream.ok) {
      throw new Error(`AI klaida: ${upstream.status}`);
    }
    const aiJson = (await upstream.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const raw = aiJson.choices?.[0]?.message?.content?.trim() ?? "";
    const cleaned = raw.replace(/```json|```/gi, "").trim();
    let summary: Record<string, string>;
    try {
      summary = JSON.parse(cleaned);
    } catch {
      summary = { topic: "", insight: cleaned.slice(0, 400), action: "", next_step: "" };
    }

    await supabaseAdmin
      .from("clarity_bookings")
      .update({ summary })
      .eq("id", booking.id);

    return { summary };
  });
