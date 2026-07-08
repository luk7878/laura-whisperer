import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const bodySchema = z.object({
  token: z.string().uuid(),
  wants_subscription: z.boolean().optional(),
  wants_human_session: z.boolean().optional(),
  human_session_preferred_at: z.string().datetime().optional().nullable(),
  human_session_note: z.string().trim().max(1000).optional().nullable(),
  phone: z.string().trim().min(5).max(32).regex(/^[+0-9\s()\-]+$/, "Netinkamas telefono numeris").optional().nullable(),
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
        const update: {
          wants_subscription?: boolean;
          wants_human_session?: boolean;
          human_session_requested_at?: string;
          human_session_preferred_at?: string | null;
          human_session_note?: string | null;
          phone?: string | null;
        } = {};
        if (parsed.data.wants_subscription != null) update.wants_subscription = parsed.data.wants_subscription;
        if (parsed.data.wants_human_session != null) {
          update.wants_human_session = parsed.data.wants_human_session;
          if (parsed.data.wants_human_session === true) {
            update.human_session_requested_at = new Date().toISOString();
          }
        }
        if (parsed.data.human_session_preferred_at !== undefined) {
          update.human_session_preferred_at = parsed.data.human_session_preferred_at;
        }
        if (parsed.data.human_session_note !== undefined) {
          update.human_session_note = parsed.data.human_session_note;
        }
        if (parsed.data.phone !== undefined) {
          update.phone = parsed.data.phone;
        }
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
