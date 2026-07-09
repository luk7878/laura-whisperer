
-- Lock knowledge tables to admins only
DROP POLICY IF EXISTS "own docs" ON public.knowledge_documents;
DROP POLICY IF EXISTS "own chunks" ON public.knowledge_chunks;

CREATE POLICY "admin manages docs"
  ON public.knowledge_documents FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin'));

CREATE POLICY "admin manages chunks"
  ON public.knowledge_chunks FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin'));

-- Rework match_knowledge: search across admin-owned knowledge, callable by any signed-in user.
CREATE OR REPLACE FUNCTION public.match_knowledge(query_embedding vector, match_count integer DEFAULT 6)
RETURNS TABLE(chunk_id uuid, document_id uuid, document_title text, content text, similarity double precision)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  select
    c.id as chunk_id,
    c.document_id,
    d.title as document_title,
    c.content,
    1 - (c.embedding <=> query_embedding) as similarity
  from public.knowledge_chunks c
  join public.knowledge_documents d on d.id = c.document_id
  where exists (
    select 1 from public.user_roles ur
    where ur.user_id = c.user_id and ur.role = 'admin'
  )
  order by c.embedding <=> query_embedding
  limit match_count;
$$;

REVOKE ALL ON FUNCTION public.match_knowledge(vector, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.match_knowledge(vector, integer) TO authenticated, service_role;
