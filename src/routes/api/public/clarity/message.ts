import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { AI_GATEWAY_URL, requireLovableApiKey } from "@/lib/ai-gateway.server";
import { CLARITY_SYSTEM_PROMPT } from "@/lib/clarity-prompt";
import { checkSafetyRules } from "@/lib/clarity-safety";
import { extractSafetyPayload } from "@/lib/parse-safety-payload";

const bodySchema = z.object({
  token: z.string().uuid(),
  content: z.string().trim().min(1).max(2000),
  emotional_start: z.number().int().min(1).max(10).optional().nullable(),
});

export const Route = createFileRoute("/api/public/clarity/message")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let raw: unknown;
        try {
          raw = await request.json();
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }
        const parsed = bodySchema.safeParse(raw);
        if (!parsed.success) return new Response("Netinkami duomenys", { status: 400 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Validate token → booking
        const { data: booking, error: bErr } = await supabaseAdmin
          .from("clarity_bookings")
          .select("id, status, emotional_start, safety_triggered")
          .eq("access_token", parsed.data.token)
          .maybeSingle();
        if (bErr || !booking) return new Response("Booking not found", { status: 404 });
        if (booking.status === "completed") return new Response("Session finished", { status: 410 });

        // Optionally set emotional_start on first message
        if (booking.emotional_start == null && parsed.data.emotional_start != null) {
          await supabaseAdmin
            .from("clarity_bookings")
            .update({
              emotional_start: parsed.data.emotional_start,
              status: "started",
              started_at: new Date().toISOString(),
            })
            .eq("id", booking.id);
        } else if (booking.status === "booked") {
          await supabaseAdmin
            .from("clarity_bookings")
            .update({ status: "started", started_at: new Date().toISOString() })
            .eq("id", booking.id);
        }

        // Persist user message
        await supabaseAdmin.from("clarity_messages").insert({
          booking_id: booking.id,
          role: "user",
          content: parsed.data.content,
        });

        // Load history (chronological)
        const { data: history } = await supabaseAdmin
          .from("clarity_messages")
          .select("role, content, created_at")
          .eq("booking_id", booking.id)
          .order("created_at", { ascending: true });

        const messages = (history ?? [])
          .filter((m) => m.role === "user" || m.role === "assistant")
          .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

        // Hard safety check
        const emotionalStart = booking.emotional_start ?? parsed.data.emotional_start ?? null;
        const recentUser = messages.filter((m) => m.role === "user").slice(-3).map((m) => m.content);
        const safety = checkSafetyRules({
          latestUserContent: parsed.data.content,
          recentUserMessages: recentUser,
          emotionalStart,
        });

        if (safety.level !== "none" && !booking.safety_triggered) {
          await supabaseAdmin
            .from("clarity_bookings")
            .update({ safety_triggered: true, safety_reason: safety.reason })
            .eq("id", booking.id);
        }

        // Call AI (non-streaming for simplicity — 15 min session, short responses)
        const key = requireLovableApiKey();
        const upstream = await fetch(`${AI_GATEWAY_URL}/chat/completions`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            stream: false,
            messages: [{ role: "system", content: CLARITY_SYSTEM_PROMPT }, ...messages],
          }),
        });

        if (!upstream.ok) {
          const t = await upstream.text().catch(() => "");
          console.error("clarity AI error", upstream.status, t);
          return new Response("AI klaida", { status: 502 });
        }
        const aiJson = (await upstream.json()) as {
          choices?: { message?: { content?: string } }[];
        };
        const rawAssistant = aiJson.choices?.[0]?.message?.content ?? "";
        const { clean, payload } = extractSafetyPayload(rawAssistant);

        // Combine soft AI signal with hard rules
        let finalSafety = safety;
        if (payload?.need_human && finalSafety.level === "none") {
          finalSafety = { level: "soft", reason: payload.reason ?? "AI aptiko, kad reikia žmogaus." };
          await supabaseAdmin
            .from("clarity_bookings")
            .update({ safety_triggered: true, safety_reason: finalSafety.reason })
            .eq("id", booking.id);
        }

        // Persist assistant message (cleaned)
        await supabaseAdmin.from("clarity_messages").insert({
          booking_id: booking.id,
          role: "assistant",
          content: clean,
        });

        return Response.json({
          reply: clean,
          safety: finalSafety,
        });
      },
    },
  },
});
