import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const bodySchema = z.object({
  token: z.string().uuid(),
  wants_subscription: z.boolean().optional(),
  wants_human_session: z.boolean().optional(),
});

export const Route = createFileRoute("/api/public/clarity/interest")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let raw: unknown;
        try { raw = await request.json(); } catch { return new Response("Invalid JSON", { status: 400 }); }
        const parsed = bodySchema.safeParse(raw);
        if (!parsed.success) return new Response("Netinkami duomenys", { status: 400 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const update: { wants_subscription?: boolean; wants_human_session?: boolean } = {};
        if (parsed.data.wants_subscription != null) update.wants_subscription = parsed.data.wants_subscription;
        if (parsed.data.wants_human_session != null) update.wants_human_session = parsed.data.wants_human_session;
        if (Object.keys(update).length === 0) return Response.json({ ok: true });

        const { error } = await supabaseAdmin
          .from("clarity_bookings")
          .update(update)
          .eq("access_token", parsed.data.token);

        if (error) {
          console.error("interest update error", error);
          return new Response("Klaida", { status: 500 });
        }
        return Response.json({ ok: true });
      },
    },
  },
});
