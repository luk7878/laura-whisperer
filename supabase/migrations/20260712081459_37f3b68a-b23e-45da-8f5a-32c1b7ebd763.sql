-- A vision statement may support several values, each with a user-owned rationale.
CREATE TABLE IF NOT EXISTS public.vision_item_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  vision_item_id uuid NOT NULL REFERENCES public.vision_items(id) ON DELETE CASCADE,
  value_id uuid NOT NULL REFERENCES public.values(id) ON DELETE CASCADE,
  rationale text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (vision_item_id, value_id)
);

CREATE INDEX IF NOT EXISTS vision_item_values_user_idx
  ON public.vision_item_values(user_id, vision_item_id);

ALTER TABLE public.vision_item_values ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vision_item_values TO authenticated;
GRANT ALL ON public.vision_item_values TO service_role;

DROP POLICY IF EXISTS "own vision item values" ON public.vision_item_values;
CREATE POLICY "own vision item values"
  ON public.vision_item_values FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_vision_item_values_updated_at ON public.vision_item_values;
CREATE TRIGGER update_vision_item_values_updated_at
  BEFORE UPDATE ON public.vision_item_values
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Preserve the existing primary link as the first multi-value association.
INSERT INTO public.vision_item_values (user_id, vision_item_id, value_id, rationale)
SELECT user_id, id, linked_value_id, why
FROM public.vision_items
WHERE linked_value_id IS NOT NULL
ON CONFLICT (vision_item_id, value_id) DO NOTHING;