import { createFileRoute } from "@tanstack/react-router";
import { AI_GATEWAY_URL, requireLovableApiKey } from "@/lib/ai-gateway.server";

export const Route = createFileRoute("/api/transcribe")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const form = await request.formData();
        const file = form.get("file");
        if (!(file instanceof Blob)) {
          return new Response("Missing audio file", { status: 400 });
        }
        const key = requireLovableApiKey();

        const upstream = new FormData();
        // Name file with proper extension based on MIME.
        const mime = (file as File).type || "audio/webm";
        const ext =
          mime.includes("webm") ? "webm"
          : mime.includes("mp4") ? "mp4"
          : mime.includes("mpeg") ? "mp3"
          : mime.includes("wav") ? "wav"
          : "webm";
        upstream.append("file", file, `recording.${ext}`);
        upstream.append("model", "openai/gpt-4o-mini-transcribe");

        const resp = await fetch(`${AI_GATEWAY_URL}/audio/transcriptions`, {
          method: "POST",
          headers: { Authorization: `Bearer ${key}` },
          body: upstream,
        });
        if (!resp.ok) {
          const t = await resp.text().catch(() => "");
          return new Response(t || "Transcription failed", { status: resp.status });
        }
        const data = await resp.json();
        return Response.json({ text: data.text ?? "" });
      },
    },
  },
});
