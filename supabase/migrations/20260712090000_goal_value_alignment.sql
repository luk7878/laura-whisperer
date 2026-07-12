ALTER TABLE public.goals
  ADD COLUMN IF NOT EXISTS value_alignment_score smallint
    CHECK (value_alignment_score BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS value_alignment jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS alignment_updated_at timestamptz;

COMMENT ON COLUMN public.goals.value_alignment_score IS
  '0–100 reflective score derived from ownership and demonstrated value links; not a judgment of the goal.';

