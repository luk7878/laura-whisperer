CREATE TABLE IF NOT EXISTS public.vision_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  category text NOT NULL CHECK (category IN ('be', 'do', 'have')),
  horizon text NOT NULL DEFAULT 'long_term' CHECK (horizon IN ('now', '1_year', '5_years', 'long_term')),
  content text NOT NULL DEFAULT '',
  why text NOT NULL DEFAULT '',
  evidence text NOT NULL DEFAULT '',
  linked_value_id uuid REFERENCES public.values(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, category, horizon)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vision_items TO authenticated;
GRANT ALL ON public.vision_items TO service_role;

ALTER TABLE public.vision_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own vision items" ON public.vision_items;
CREATE POLICY "own vision items" ON public.vision_items
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS vision_items_user_id_idx ON public.vision_items(user_id);
CREATE INDEX IF NOT EXISTS vision_items_value_id_idx ON public.vision_items(linked_value_id);

CREATE TRIGGER update_vision_items_updated_at
  BEFORE UPDATE ON public.vision_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();