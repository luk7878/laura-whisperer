import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "get_session_messages",
  title: "Get session messages",
  description:
    "Fetch the full message history (client statements + Demartini AI analyses) for a specific coaching session.",
  inputSchema: {
    session_id: z.string().uuid().describe("The session id to load."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ session_id }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const supabase = supabaseForUser(ctx);
    const { data: session, error: sErr } = await supabase
      .from("sessions")
      .select("id, title, client_name, created_at, updated_at")
      .eq("id", session_id)
      .maybeSingle();
    if (sErr)
      return { content: [{ type: "text", text: sErr.message }], isError: true };
    if (!session)
      return { content: [{ type: "text", text: "Session not found" }], isError: true };
    const { data: messages, error: mErr } = await supabase
      .from("messages")
      .select("id, role, content, created_at")
      .eq("session_id", session_id)
      .order("created_at", { ascending: true });
    if (mErr)
      return { content: [{ type: "text", text: mErr.message }], isError: true };
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ session, messages: messages ?? [] }),
        },
      ],
      structuredContent: { session, messages: messages ?? [] },
    };
  },
});
