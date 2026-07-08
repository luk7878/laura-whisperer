import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const bookSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(255),
  concern: z.string().trim().max(1000).optional().nullable(),
  scheduled_at: z.string().datetime().optional().nullable(),
  consent_accepted: z.boolean().refine((v) => v === true, "Privalote sutikti"),
});

export const Route = createFileRoute("/api/public/clarity/book")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "Invalid JSON" }, { status: 400 });
        }
        const parsed = bookSchema.safeParse(body);
        if (!parsed.success) {
          return Response.json({ error: parsed.error.issues[0]?.message ?? "Netinkami duomenys" }, { status: 400 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin
          .from("clarity_bookings")
          .insert({
            name: parsed.data.name,
            email: parsed.data.email,
            concern: parsed.data.concern ?? null,
            scheduled_at: parsed.data.scheduled_at ?? null,
            consent_accepted: parsed.data.consent_accepted,
            status: "booked",
          })
          .select("id, access_token")
          .single();

        if (error || !data) {
          console.error("clarity_book insert error", error);
          return Response.json({ error: "Nepavyko sukurti rezervacijos" }, { status: 500 });
        }

        return Response.json({ id: data.id, access_token: data.access_token });
      },
    },
  },
});
