
-- extend sessions with live-map state
ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS active_topic text,
  ADD COLUMN IF NOT EXISTS active_column text,
  ADD COLUMN IF NOT EXISTS active_belief text,
  ADD COLUMN IF NOT EXISTS emotional_start smallint,
  ADD COLUMN IF NOT EXISTS emotional_current smallint,
  ADD COLUMN IF NOT EXISTS emotional_end smallint,
  ADD COLUMN IF NOT EXISTS patterns jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS grid jsonb NOT NULL DEFAULT '{}'::jsonb;

-- values (vertybės)
CREATE TABLE IF NOT EXISTS public.values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  rank smallint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.values TO authenticated;
GRANT ALL ON public.values TO service_role;
ALTER TABLE public.values ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own values" ON public.values;
CREATE POLICY "own values" ON public.values FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- goals
CREATE TABLE IF NOT EXISTS public.goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  target_date date,
  linked_value_id uuid REFERENCES public.values(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'active',
  progress smallint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.goals TO authenticated;
GRANT ALL ON public.goals TO service_role;
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own goals" ON public.goals;
CREATE POLICY "own goals" ON public.goals FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- vision
CREATE TABLE IF NOT EXISTS public.vision (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  horizon_years smallint NOT NULL,
  content text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, horizon_years)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vision TO authenticated;
GRANT ALL ON public.vision TO service_role;
ALTER TABLE public.vision ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own vision" ON public.vision;
CREATE POLICY "own vision" ON public.vision FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- priorities
CREATE TABLE IF NOT EXISTS public.priorities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  due_date date,
  done boolean NOT NULL DEFAULT false,
  linked_goal_id uuid REFERENCES public.goals(id) ON DELETE SET NULL,
  linked_value_id uuid REFERENCES public.values(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.priorities TO authenticated;
GRANT ALL ON public.priorities TO service_role;
ALTER TABLE public.priorities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own priorities" ON public.priorities;
CREATE POLICY "own priorities" ON public.priorities FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- journal_entries
CREATE TABLE IF NOT EXISTS public.journal_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  session_id uuid REFERENCES public.sessions(id) ON DELETE CASCADE,
  summary text NOT NULL,
  patterns jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.journal_entries TO authenticated;
GRANT ALL ON public.journal_entries TO service_role;
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own journal" ON public.journal_entries;
CREATE POLICY "own journal" ON public.journal_entries FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- progress_snapshots
CREATE TABLE IF NOT EXISTS public.progress_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  session_id uuid REFERENCES public.sessions(id) ON DELETE CASCADE,
  emotional_start smallint,
  emotional_end smallint,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.progress_snapshots TO authenticated;
GRANT ALL ON public.progress_snapshots TO service_role;
ALTER TABLE public.progress_snapshots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own snapshots" ON public.progress_snapshots;
CREATE POLICY "own snapshots" ON public.progress_snapshots FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
