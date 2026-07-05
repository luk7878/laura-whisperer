import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { chunkText, embedTexts } from "@/lib/knowledge-embed.server";

type Body = {
  title?: string;
  source_type?: string;
  file_path?: string | null;
  byte_size?: number | null;
  text?: string;
};

export const Route = createFileRoute("/api/knowledge-ingest")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = request.headers.get("authorization") ?? request.headers.get("Authorization");
        if (!auth || !auth.toLowerCase().startsWith("bearer ")) {
          return new Response("Unauthorized", { status: 401 });
        }
        const token = auth.slice(7).trim();

        const body = (await request.json()) as Body;
        const text = (body.text ?? "").trim();
        const title = (body.title ?? "").trim() || "Be pavadinimo";
        if (!text) return new Response("Missing text", { status: 400 });
        if (text.length > 5_000_000) return new Response("Text too large", { status: 413 });

        const url = process.env.SUPABASE_URL;
        const anon = process.env.SUPABASE_PUBLISHABLE_KEY;
        if (!url || !anon) return new Response("Server misconfigured", { status: 500 });

        const supabase = createClient(url, anon, {
          global: { headers: { Authorization: `Bearer ${token}` } },
          auth: { persistSession: false, autoRefreshToken: false },
        });

        const { data: userData, error: userErr } = await supabase.auth.getUser();
        if (userErr || !userData.user) return new Response("Unauthorized", { status: 401 });
        const userId = userData.user.id;

        // Insert document row (status = processing)
        const { data: doc, error: docErr } = await supabase
          .from("knowledge_documents")
          .insert({
            user_id: userId,
            title: title.slice(0, 200),
            source_type: body.source_type ?? "text",
            file_path: body.file_path ?? null,
            byte_size: body.byte_size ?? text.length,
            status: "processing",
          })
          .select("id")
          .single();
        if (docErr || !doc) {
          return new Response(docErr?.message ?? "Insert failed", { status: 500 });
        }

        try {
          const chunks = chunkText(text);
          if (chunks.length === 0) {
            await supabase
              .from("knowledge_documents")
              .update({ status: "empty", chunk_count: 0 })
              .eq("id", doc.id);
            return Response.json({ id: doc.id, chunks: 0, status: "empty" });
          }
          const vectors = await embedTexts(chunks);
          const rows = chunks.map((content, i) => ({
            document_id: doc.id,
            user_id: userId,
            chunk_index: i,
            content,
            // pgvector accepts JSON array string
            embedding: JSON.stringify(vectors[i]),
          }));
          // insert in batches of 50 to keep payloads reasonable
          for (let i = 0; i < rows.length; i += 50) {
            const slice = rows.slice(i, i + 50);
            const { error: insErr } = await supabase.from("knowledge_chunks").insert(slice);
            if (insErr) throw insErr;
          }
          await supabase
            .from("knowledge_documents")
            .update({ status: "ready", chunk_count: chunks.length })
            .eq("id", doc.id);
          return Response.json({ id: doc.id, chunks: chunks.length, status: "ready" });
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : "Ingest failed";
          await supabase
            .from("knowledge_documents")
            .update({ status: "error", error: msg })
            .eq("id", doc.id);
          return new Response(msg, { status: 500 });
        }
      },
    },
  },
});
