CREATE TABLE public.goal_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  goal_id UUID NOT NULL REFERENCES public.goals(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES public.goal_tasks(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  why TEXT,
  depth INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  estimate TEXT,
  due_date DATE,
  done BOOLEAN NOT NULL DEFAULT false,
  done_at TIMESTAMPTZ,
  ai_generated BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.goal_tasks TO authenticated;
GRANT ALL ON public.goal_tasks TO service_role;

ALTER TABLE public.goal_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own goal tasks"
ON public.goal_tasks FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_goal_tasks_goal ON public.goal_tasks(goal_id);
CREATE INDEX idx_goal_tasks_parent ON public.goal_tasks(parent_id);

CREATE TRIGGER update_goal_tasks_updated_at
BEFORE UPDATE ON public.goal_tasks
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();