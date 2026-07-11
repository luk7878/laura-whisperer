CREATE TABLE IF NOT EXISTS public.value_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'completed')),
  current_step smallint NOT NULL DEFAULT 0 CHECK (current_step BETWEEN 0 AND 10),
  answers jsonb NOT NULL DEFAULT '[]'::jsonb,
  result jsonb NOT NULL DEFAULT '[]'::jsonb,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.value_assessments TO authenticated;
GRANT ALL ON public.value_assessments TO service_role;

ALTER TABLE public.value_assessments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own value assessments" ON public.value_assessments;
CREATE POLICY "own value assessments"
  ON public.value_assessments
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS value_assessments_user_updated_idx
  ON public.value_assessments(user_id, updated_at DESC);

DROP TRIGGER IF EXISTS update_value_assessments_updated_at ON public.value_assessments;
CREATE TRIGGER update_value_assessments_updated_at
  BEFORE UPDATE ON public.value_assessments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();