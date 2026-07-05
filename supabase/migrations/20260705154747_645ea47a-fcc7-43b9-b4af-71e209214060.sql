
CREATE TABLE public.action_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  session_id UUID REFERENCES public.sessions(id) ON DELETE SET NULL,
  goal_id UUID,
  title TEXT NOT NULL,
  summary TEXT,
  steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.action_plans TO authenticated;
GRANT ALL ON public.action_plans TO service_role;

ALTER TABLE public.action_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own action_plans" ON public.action_plans
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_action_plans_updated_at
  BEFORE UPDATE ON public.action_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.goals ADD COLUMN IF NOT EXISTS linked_plan_id UUID;
ALTER TABLE public.priorities ADD COLUMN IF NOT EXISTS linked_plan_id UUID;
