import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/clarity/slots")({
  server: {
    handlers: {
      GET: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin
          .from("clarity_slot_state")
          .select("capacity, filled")
          .eq("id", 1)
          .maybeSingle();
        if (error || !data) {
          return Response.json({ capacity: 0, remaining: 0 });
        }
        return Response.json({
          capacity: data.capacity,
          remaining: Math.max(0, data.capacity - data.filled),
        });
      },
    },
  },
});
