import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { AI_GATEWAY_URL, requireLovableApiKey } from "@/lib/ai-gateway.server";
import { DEMARTINI_SYSTEM_PROMPT } from "@/lib/demartini-prompt";
import { GOAL_CLARIFY_SYSTEM_PROMPT } from "@/lib/goal-clarify-prompt";
import { buildUserValueContext } from "@/lib/value-context.server";
import type { Database } from "@/integrations/supabase/types";

type ChatMsg = { role: "user" | "assistant"; content: string };
type Mode = "demartini" | "goal_clarify";

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = request.headers.get("authorization") ?? request.headers.get("Authorization");
        if (!auth || !auth.toLowerCase().startsWith("bearer ")) {
          return new Response("Unauthorized", { status: 401 });
        }
        const token = auth.slice(7).trim();
        const body = (await request.json()) as { messages?: ChatMsg[]; mode?: Mode };
        const messages = Array.isArray(body.messages) ? body.messages : [];
        const mode: Mode = body.mode === "goal_clarify" ? "goal_clarify" : "demartini";
        const basePrompt =
          mode === "goal_clarify" ? GOAL_CLARIFY_SYSTEM_PROMPT : DEMARTINI_SYSTEM_PROMPT;
        const url = import.meta.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
        const anon =
          import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
        if (!url || !anon) return new Response("Server misconfigured", { status: 500 });
        const supabase = createClient<Database>(url, anon, {
          global: { headers: { Authorization: `Bearer ${token}` } },
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const lastUser = [...messages].reverse().find((message) => message.role === "user");
        const valueContext = await buildUserValueContext(supabase, lastUser?.content ?? "");
        const systemPrompt = `${basePrompt}${valueContext.prompt}`;
        const key = requireLovableApiKey();

        const upstream = await fetch(`${AI_GATEWAY_URL}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${key}`,
          },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            stream: true,
            messages: [{ role: "system", content: systemPrompt }, ...messages],
          }),
        });

        if (!upstream.ok || !upstream.body) {
          const text = await upstream.text().catch(() => "");
          return new Response(text || "AI error", { status: upstream.status });
        }

        // Transform OpenAI SSE stream → plain text stream of delta tokens
        const encoder = new TextEncoder();
        const decoder = new TextDecoder();
        const reader = upstream.body.getReader();

        const stream = new ReadableStream({
          async start(controller) {
            let buffer = "";
            try {
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n");
                buffer = lines.pop() ?? "";
                for (const line of lines) {
                  const trimmed = line.trim();
                  if (!trimmed.startsWith("data:")) continue;
                  const data = trimmed.slice(5).trim();
                  if (data === "[DONE]") continue;
                  try {
                    const json = JSON.parse(data);
                    const delta = json.choices?.[0]?.delta?.content;
                    if (delta) controller.enqueue(encoder.encode(delta));
                  } catch {
                    // skip
                  }
                }
              }
              controller.close();
            } catch (e) {
              controller.error(e);
            }
          },
        });

        return new Response(stream, {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "no-cache",
          },
        });
      },
    },
  },
});
