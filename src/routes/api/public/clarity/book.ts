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
        const { data: rpcData, error } = await supabaseAdmin.rpc("book_clarity_slot", {
          p_name: parsed.data.name,
          p_email: parsed.data.email,
          p_concern: parsed.data.concern ?? "",
          p_scheduled_at: parsed.data.scheduled_at ?? new Date().toISOString(),
          p_consent_accepted: parsed.data.consent_accepted,
        });

        if (error || !rpcData) {
          console.error("clarity_book rpc error", error);
          return Response.json({ error: "Nepavyko sukurti rezervacijos" }, { status: 500 });
        }

        const data = rpcData as {
          waitlisted: boolean;
          id?: string;
          access_token?: string;
          waitlist_id?: string;
        };

        if (data.waitlisted) {
          return Response.json({ waitlisted: true });
        }

        // Send confirmation email with session link (fire-and-forget style; log failures)
        try {
          const { enqueueInternalTransactionalEmail } = await import(
            "@/lib/email/send-internal.server"
          );
          const PUBLIC_ORIGIN = "https://mentor.lauraborusaite.lt";
          const requestOrigin = new URL(request.url).origin;
          const origin = /localhost|127\.0\.0\.1/.test(requestOrigin) ? PUBLIC_ORIGIN : requestOrigin;
          const sessionUrl = `${origin}/sesija/${data.access_token}`;
          const result = await enqueueInternalTransactionalEmail({
            templateName: "clarity-booking-confirmation",
            recipientEmail: parsed.data.email,
            idempotencyKey: `clarity-book-${data.id}`,
            templateData: {
              name: parsed.data.name,
              sessionUrl,
              scheduledAt: parsed.data.scheduled_at ?? null,
            },
          });
          if (!result.success) {
            console.warn("clarity_book email not queued", result);
          }
        } catch (e) {
          console.error("clarity_book email error", e);
        }

        return Response.json({ id: data.id, access_token: data.access_token });
      },
    },
  },
});
