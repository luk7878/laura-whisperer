import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin only");
}

export const getSlotState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    
    const { data, error } = await context.supabase
      .from("clarity_slot_state")
      .select("capacity, filled, updated_at")
      .eq("id", 1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ?? { capacity: 30, filled: 0, updated_at: null };
  });

export const updateSlotCapacity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ capacity: z.number().int().min(0).max(10000) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    
    const { error } = await context.supabase
      .from("clarity_slot_state")
      .update({ capacity: data.capacity, updated_at: new Date().toISOString() })
      .eq("id", 1);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const resetSlotFilled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    
    const { error } = await context.supabase
      .from("clarity_slot_state")
      .update({ filled: 0, updated_at: new Date().toISOString() })
      .eq("id", 1);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listWaitlist = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    
    const { data, error } = await context.supabase
      .from("clarity_waitlist")
      .select("id, name, email, concern, status, notified_at, created_at")
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return { entries: data ?? [] };
  });

export const updateWaitlistStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({
      id: z.string().uuid(),
      status: z.enum(["waiting", "notified", "converted", "cancelled"]),
    }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    
    const patch: { status: string; notified_at?: string } = { status: data.status };
    if (data.status === "notified") patch.notified_at = new Date().toISOString();
    const { error } = await context.supabase
      .from("clarity_waitlist")
      .update(patch)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
