import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/clarity/history")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const token = url.searchParams.get("token");
        if (!token) return new Response("Missing token", { status: 400 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: booking } = await supabaseAdmin
          .from("clarity_bookings")
          .select("id, status, emotional_start, started_at, safety_triggered")
          .eq("access_token", token)
          .maybeSingle();

        if (!booking) return new Response("Not found", { status: 404 });

        const { data: history } = await supabaseAdmin
          .from("clarity_messages")
          .select("role, content, created_at")
          .eq("booking_id", booking.id)
          .order("created_at", { ascending: true });

        const messages = (history ?? [])
          .filter((m) => m.role === "user" || m.role === "assistant")
          .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

        return Response.json({
          status: booking.status,
          emotional_start: booking.emotional_start,
          started_at: booking.started_at,
          messages,
        });
      },
    },
  },
});
