import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "create_session",
  title: "Create coaching session",
  description:
    "Create a new empty Demartini coaching session for the signed-in coach. Returns the created session id.",
  inputSchema: {
    title: z.string().trim().min(1).max(200).describe("Session title."),
    client_name: z
      .string()
      .trim()
      .max(200)
      .optional()
      .describe("Optional client name."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ title, client_name }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const { data, error } = await supabaseForUser(ctx)
      .from("sessions")
      .insert({ user_id: ctx.getUserId()!, title, client_name: client_name ?? null })
      .select("id, title, client_name, created_at, updated_at")
      .single();
    if (error)
      return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
      structuredContent: { session: data },
    };
  },
});
