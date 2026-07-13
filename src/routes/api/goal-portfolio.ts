import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { AI_GATEWAY_URL, requireLovableApiKey } from "@/lib/ai-gateway.server";
import { buildUserValueContext } from "@/lib/value-context.server";
import type { Database } from "@/integrations/supabase/types";

function estimateHours(estimate: string | null) {
  if (!estimate) return 0;
  const value = Number(estimate.replace(",", ".").match(/[\d.]+/)?.[0] ?? 0);
  const normalized = estimate.toLowerCase();
  if (normalized.includes("sav")) return value * 10;
  if (normalized.includes(" d")) return value * 6;
  return normalized.includes("val") ? value : 0;
}

export const Route = createFileRoute("/api/goal-portfolio")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = request.headers.get("authorization") ?? request.headers.get("Authorization");
        if (!auth?.toLowerCase().startsWith("bearer "))
          return new Response("Unauthorized", { status: 401 });
        const token = auth.slice(7).trim();
        const url = import.meta.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
        const anon =
          import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
        if (!url || !anon) return new Response("Server misconfigured", { status: 500 });
        const supabase = createClient<Database>(url, anon, {
          global: { headers: { Authorization: `Bearer ${token}` } },
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { data: authData } = await supabase.auth.getUser(token);
        if (!authData.user) return new Response("Unauthorized", { status: 401 });

        const [{ data: goals }, { data: tasks }] = await Promise.all([
          supabase
            .from("goals")
            .select("id,title,description,target_date,progress,linked_value_id,value_alignment")
            .eq("status", "active"),
          supabase
            .from("goal_tasks")
            .select("id,goal_id,title,estimate,due_date,depth,done")
            .eq("done", false),
        ]);
        const activeGoals = goals ?? [];
        const goalIds = new Set(activeGoals.map((goal) => goal.id));
        const relevantTasks = (tasks ?? []).filter((task) => goalIds.has(task.goal_id));
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const weekEnd = new Date(today);
        weekEnd.setDate(weekEnd.getDate() + 7);
        const weeklyTasks = relevantTasks.filter((task) => {
          if (!task.due_date) return false;
          const due = new Date(`${task.due_date}T00:00:00`);
          return due <= weekEnd;
        });
        const weeklyHours =
          Math.round(
            weeklyTasks.reduce((sum, task) => sum + estimateHours(task.estimate), 0) * 10,
          ) / 10;

        if (activeGoals.length < 2) {
          return Response.json({
            analysis: {
              summary: "Portfelyje nėra pakankamai tikslų tarpusavio konfliktams vertinti.",
              recommended_active_goal_ids: activeGoals.map((goal) => goal.id),
              conflicts: [],
              duplicates: [],
              deadline_risks: [],
              actions: [],
            },
            metrics: {
              active_goals: activeGoals.length,
              weekly_hours: weeklyHours,
              weekly_tasks: weeklyTasks.length,
            },
          });
        }

        const valueContext = await buildUserValueContext(
          supabase,
          activeGoals.map((goal) => `${goal.title} ${goal.description ?? ""}`).join(" "),
        );
        const key = requireLovableApiKey();
        const upstream = await fetch(`${AI_GATEWAY_URL}/chat/completions`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            response_format: { type: "json_object" },
            temperature: 0.15,
            messages: [
              {
                role: "system",
                content: `Tu esi tikslų portfelio strategas. Analizuok tik pateiktus tikslus ir nieko automatiškai nenuspręsk už žmogų. Rekomenduok daugiausia 3 aktyvius tikslus.
Grąžink tik JSON:
{"summary":"2–3 sakinių aiški išvada","recommended_active_goal_ids":["tikslūs id, daugiausia 3"],"conflicts":[{"goal_ids":["id","id"],"reason":"dėl ko konkuruoja"}],"duplicates":[{"goal_ids":["id","id"],"reason":"konkretus sutapimas","suggested_title":"galimas bendras tikslas"}],"deadline_risks":[{"goal_id":"id","reason":"kodėl terminas rizikingas","suggestion":"konkretus pakeitimas"}],"actions":[{"kind":"pause|merge|split","goal_ids":["id"],"title":"trumpas pasiūlymas","reason":"kodėl"}]}
Taisyklės:
- Konfliktas yra tik tada, kai tikslai realiai konkuruoja dėl to paties laiko, pinigų, energijos arba prieštarauja vienas kitam.
- Dublikatu laikyk tą patį norimą rezultatą, ne vien panašius žodžius.
- Nerealų terminą vertink pagal likusias užduotis, jų įverčius, progresą ir datą.
- Jei tikslas per platus ar turi kelis savarankiškus rezultatus, siūlyk split.
- Vertybės padeda pasirinkti fokusą, tačiau neminėk jų dirbtinai.
${valueContext.prompt}`,
              },
              {
                role: "user",
                content: JSON.stringify({
                  today: today.toISOString().slice(0, 10),
                  weekly_hours_from_due_tasks: weeklyHours,
                  goals: activeGoals,
                  tasks: relevantTasks,
                }),
              },
            ],
          }),
        });
        if (!upstream.ok) return new Response(await upstream.text(), { status: upstream.status });
        const json = (await upstream.json()) as { choices?: { message?: { content?: string } }[] };
        const raw = json.choices?.[0]?.message?.content?.replace(/```json|```/g, "").trim();
        if (!raw) return new Response("AI negrąžino analizės", { status: 502 });
        const analysis = JSON.parse(raw) as Record<string, unknown>;
        return Response.json({
          analysis,
          metrics: {
            active_goals: activeGoals.length,
            weekly_hours: weeklyHours,
            weekly_tasks: weeklyTasks.length,
          },
        });
      },
    },
  },
});
