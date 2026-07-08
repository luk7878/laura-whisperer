// Server-only helper to enqueue transactional email from unauthenticated public routes
// (e.g., contact/booking forms). Mirrors /lovable/email/transactional/send but uses
// service role instead of user JWT.
import * as React from "react";
import { render } from "@react-email/render";
import { TEMPLATES } from "@/lib/email-templates/registry";

const SITE_NAME = "Laura Borusaitė";
const SENDER_DOMAIN = "notify.lauraborusaite.lt";
const FROM_DOMAIN = "lauraborusaite.lt";

function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function enqueueInternalTransactionalEmail(opts: {
  templateName: string;
  recipientEmail: string;
  idempotencyKey?: string;
  templateData?: Record<string, any>;
}): Promise<{ success: boolean; reason?: string; error?: string }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const template = TEMPLATES[opts.templateName];
  if (!template) return { success: false, error: `Template '${opts.templateName}' not found` };

  const recipient = template.to || opts.recipientEmail;
  if (!recipient) return { success: false, error: "recipientEmail required" };

  const messageId = crypto.randomUUID();
  const idempotencyKey = opts.idempotencyKey || messageId;
  const normalized = recipient.toLowerCase();

  const { data: suppressed } = await supabaseAdmin
    .from("suppressed_emails")
    .select("id")
    .eq("email", normalized)
    .maybeSingle();
  if (suppressed) return { success: false, reason: "email_suppressed" };

  // Ensure unsubscribe token
  let unsubscribeToken: string;
  const { data: existing } = await supabaseAdmin
    .from("email_unsubscribe_tokens")
    .select("token, used_at")
    .eq("email", normalized)
    .maybeSingle();
  if (existing && !existing.used_at) {
    unsubscribeToken = existing.token;
  } else {
    unsubscribeToken = generateToken();
    await supabaseAdmin
      .from("email_unsubscribe_tokens")
      .upsert({ token: unsubscribeToken, email: normalized }, { onConflict: "email", ignoreDuplicates: true });
    const { data: stored } = await supabaseAdmin
      .from("email_unsubscribe_tokens")
      .select("token")
      .eq("email", normalized)
      .maybeSingle();
    if (stored?.token) unsubscribeToken = stored.token;
  }

  const element = React.createElement(template.component, opts.templateData ?? {});
  const html = await render(element);
  const plainText = await render(element, { plainText: true });
  const subject =
    typeof template.subject === "function" ? template.subject(opts.templateData ?? {}) : template.subject;

  await supabaseAdmin.from("email_send_log").insert({
    message_id: messageId,
    template_name: opts.templateName,
    recipient_email: recipient,
    status: "pending",
  });

  const { error: enqueueError } = await supabaseAdmin.rpc("enqueue_email", {
    queue_name: "transactional_emails",
    payload: {
      message_id: messageId,
      to: recipient,
      from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
      sender_domain: SENDER_DOMAIN,
      subject,
      html,
      text: plainText,
      purpose: "transactional",
      label: opts.templateName,
      idempotency_key: idempotencyKey,
      unsubscribe_token: unsubscribeToken,
      queued_at: new Date().toISOString(),
    },
  });

  if (enqueueError) {
    await supabaseAdmin.from("email_send_log").insert({
      message_id: messageId,
      template_name: opts.templateName,
      recipient_email: recipient,
      status: "failed",
      error_message: "Failed to enqueue email",
    });
    return { success: false, error: "enqueue_failed" };
  }
  return { success: true };
}
