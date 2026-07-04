import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listSessionsTool from "./tools/list-sessions";
import getSessionMessagesTool from "./tools/get-session-messages";
import createSessionTool from "./tools/create-session";

const projectRef =
  import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "demartini-coach-mcp",
  title: "Demartini Coach AI",
  version: "0.1.0",
  instructions:
    "Tools for the Demartini Coach AI platform. Use `list_sessions` to browse the coach's saved sessions, `get_session_messages` to read the full analysis history of a specific session, and `create_session` to start a new coaching session.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listSessionsTool, getSessionMessagesTool, createSessionTool],
});
