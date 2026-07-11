import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { chunkText, embedTexts } from "@/lib/knowledge-embed.server";
import { cleanKnowledgeText, isChunkUseful, detectLanguage } from "@/lib/knowledge-clean";

export const Route = createFileRoute("/api/knowledge-reindex")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = request.headers.get("authorization") ?? request.headers.get("Authorization");
        if (!auth || !auth.toLowerCase().startsWith("bearer ")) {
          return new Response("Unauthorized", { status: 401 });
        }
        const token = auth.slice(7).trim();

        const body = (await request.json().catch(() => ({}))) as { document_id?: string };
        const docId = body.document_id;
        if (!docId) return new Response("Missing document_id", { status: 400 });

        const url = import.meta.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
        const anon =
          import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
        if (!url || !anon) return new Response("Server misconfigured", { status: 500 });

        const supabase = createClient(url, anon, {
          global: { headers: { Authorization: `Bearer ${token}` } },
          auth: { persistSession: false, autoRefreshToken: false },
        });

        const { data: userData, error: userErr } = await supabase.auth.getUser();
        if (userErr || !userData.user) return new Response("Unauthorized", { status: 401 });
        const userId = userData.user.id;

        const { data: doc, error: docErr } = await supabase
          .from("knowledge_documents")
          .select("id, user_id")
          .eq("id", docId)
          .maybeSingle();
        if (docErr || !doc) return new Response("Document not found", { status: 404 });
        if (doc.user_id !== userId) return new Response("Forbidden", { status: 403 });

        await supabase
          .from("knowledge_documents")
          .update({ status: "processing", error: null })
          .eq("id", docId);

        // Reconstruct source text from existing chunks (best available; original PDF/DOCX not stored as text)
        const { data: existing } = await supabase
          .from("knowledge_chunks")
          .select("chunk_index, content")
          .eq("document_id", docId)
          .order("chunk_index", { ascending: true });

        const joined = (existing ?? []).map((c) => c.content).join("\n\n");
        const cleaned = cleanKnowledgeText(joined);
        const language = detectLanguage(cleaned);

        try {
          const chunks = chunkText(cleaned).filter(isChunkUseful);

          // Delete old chunks
          const { error: delErr } = await supabase
            .from("knowledge_chunks")
            .delete()
            .eq("document_id", docId);
          if (delErr) throw delErr;

          if (chunks.length === 0) {
            await supabase
              .from("knowledge_documents")
              .update({ status: "empty", chunk_count: 0, language })
              .eq("id", docId);
            return Response.json({ id: docId, chunks: 0, status: "empty" });
          }

          const vectors = await embedTexts(chunks);
          const rows = chunks.map((content, i) => ({
            document_id: docId,
            user_id: userId,
            chunk_index: i,
            content,
            embedding: JSON.stringify(vectors[i]),
          }));
          for (let i = 0; i < rows.length; i += 50) {
            const slice = rows.slice(i, i + 50);
            const { error: insErr } = await supabase.from("knowledge_chunks").insert(slice);
            if (insErr) throw insErr;
          }

          await supabase
            .from("knowledge_documents")
            .update({ status: "ready", chunk_count: chunks.length, language, error: null })
            .eq("id", docId);

          return Response.json({ id: docId, chunks: chunks.length, status: "ready", language });
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : "Reindex failed";
          await supabase
            .from("knowledge_documents")
            .update({ status: "error", error: msg })
            .eq("id", docId);
          return new Response(msg, { status: 500 });
        }
      },
    },
  },
});
