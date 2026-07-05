import { supabase } from "@/integrations/supabase/client";

export type AITaskNode = {
  title?: string;
  why?: string;
  estimate?: string;
  due_in_days?: number;
  subtasks?: AITaskNode[];
};

export type AIBreakdown = {
  milestones?: AITaskNode[];
};

function addDays(base: Date, days: number | undefined): string | null {
  if (typeof days !== "number" || !isFinite(days)) return null;
  const d = new Date(base);
  d.setDate(d.getDate() + Math.max(0, Math.round(days)));
  return d.toISOString().slice(0, 10);
}

export async function insertTaskTree(params: {
  userId: string;
  goalId: string;
  breakdown: AIBreakdown;
}): Promise<number> {
  const { userId, goalId, breakdown } = params;
  const milestones = breakdown.milestones ?? [];
  if (milestones.length === 0) return 0;

  const now = new Date();
  let inserted = 0;

  async function insertNode(
    node: AITaskNode,
    depth: number,
    order: number,
    parentId: string | null,
  ) {
    const title = (node.title ?? "").trim();
    if (!title) return;
    const { data, error } = await supabase
      .from("goal_tasks")
      .insert({
        user_id: userId,
        goal_id: goalId,
        parent_id: parentId,
        title: title.slice(0, 200),
        why: node.why?.slice(0, 400) ?? null,
        estimate: node.estimate?.slice(0, 60) ?? null,
        due_date: addDays(now, node.due_in_days),
        depth,
        sort_order: order,
        ai_generated: true,
      })
      .select("id")
      .single();
    if (error || !data) return;
    inserted++;
    const subs = node.subtasks ?? [];
    for (let i = 0; i < subs.length; i++) {
      await insertNode(subs[i], depth + 1, i, data.id);
    }
  }

  for (let i = 0; i < milestones.length; i++) {
    await insertNode(milestones[i], 0, i, null);
  }
  return inserted;
}
