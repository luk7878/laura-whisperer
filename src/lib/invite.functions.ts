import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const CodeSchema = z.object({ code: z.string().trim().min(1).max(64) });

export const validateInviteCode = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => CodeSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("invite_codes")
      .select("active, expires_at, max_uses, uses")
      .eq("code", data.code)
      .maybeSingle();
    if (error) return { valid: false };
    if (!row || !row.active) return { valid: false };
    if (row.expires_at && new Date(row.expires_at) <= new Date()) return { valid: false };
    if (row.max_uses != null && row.uses >= row.max_uses) return { valid: false };
    return { valid: true };
  });

export const consumeInviteCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => CodeSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Atomically increment uses only when still valid
    const { data: row } = await supabaseAdmin
      .from("invite_codes")
      .select("id, active, expires_at, max_uses, uses")
      .eq("code", data.code)
      .maybeSingle();
    if (!row || !row.active) return { consumed: false };
    if (row.expires_at && new Date(row.expires_at) <= new Date()) return { consumed: false };
    if (row.max_uses != null && row.uses >= row.max_uses) return { consumed: false };
    const { error } = await supabaseAdmin
      .from("invite_codes")
      .update({ uses: row.uses + 1 })
      .eq("id", row.id);
    return { consumed: !error };
  });
