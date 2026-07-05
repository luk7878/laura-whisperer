import { createFileRoute } from "@tanstack/react-router";
import { AI_GATEWAY_URL, requireLovableApiKey } from "@/lib/ai-gateway.server";
import { DEMARTINI_SYSTEM_PROMPT } from "@/lib/demartini-prompt";
import { GOAL_CLARIFY_SYSTEM_PROMPT } from "@/lib/goal-clarify-prompt";

type ChatMsg = { role: "user" | "assistant"; content: string };
type Mode = "demartini" | "goal_clarify";

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json()) as { messages?: ChatMsg[]; mode?: Mode };
        const messages = Array.isArray(body.messages) ? body.messages : [];
        const mode: Mode = body.mode === "goal_clarify" ? "goal_clarify" : "demartini";
        const systemPrompt =
          mode === "goal_clarify" ? GOAL_CLARIFY_SYSTEM_PROMPT : DEMARTINI_SYSTEM_PROMPT;
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
            messages: [
              { role: "system", content: systemPrompt },
              ...messages,
            ],
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
