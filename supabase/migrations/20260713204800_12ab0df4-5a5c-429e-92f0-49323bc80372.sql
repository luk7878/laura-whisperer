CREATE TABLE IF NOT EXISTS public.decision_labs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  dilemma text NOT NULL,
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  analysis jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'decided', 'archived')),
  decided_option text,
  review_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS decision_labs_user_updated_idx ON public.decision_labs(user_id, updated_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.decision_labs TO authenticated;
GRANT ALL ON public.decision_labs TO service_role;
ALTER TABLE public.decision_labs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own decision labs" ON public.decision_labs;
CREATE POLICY "own decision labs" ON public.decision_labs FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP TRIGGER IF EXISTS update_decision_labs_updated_at ON public.decision_labs;
CREATE TRIGGER update_decision_labs_updated_at BEFORE UPDATE ON public.decision_labs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();