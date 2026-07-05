
create extension if not exists vector;

-- Documents
create table public.knowledge_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  title text not null,
  source_type text not null default 'text',
  file_path text,
  byte_size integer,
  chunk_count integer not null default 0,
  status text not null default 'ready',
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.knowledge_documents to authenticated;
grant all on public.knowledge_documents to service_role;
alter table public.knowledge_documents enable row level security;
create policy "own docs" on public.knowledge_documents for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create trigger tg_kd_updated before update on public.knowledge_documents
  for each row execute function public.update_updated_at_column();

-- Chunks with 1536-dim embeddings (openai/text-embedding-3-small)
create table public.knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.knowledge_documents(id) on delete cascade,
  user_id uuid not null,
  chunk_index integer not null,
  content text not null,
  embedding vector(1536) not null,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.knowledge_chunks to authenticated;
grant all on public.knowledge_chunks to service_role;
alter table public.knowledge_chunks enable row level security;
create policy "own chunks" on public.knowledge_chunks for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index knowledge_chunks_doc_idx on public.knowledge_chunks(document_id);
create index knowledge_chunks_embedding_idx on public.knowledge_chunks
  using hnsw (embedding vector_cosine_ops);

-- Semantic search RPC (scoped to caller via auth.uid())
create or replace function public.match_knowledge(
  query_embedding vector(1536),
  match_count integer default 6
)
returns table (
  chunk_id uuid,
  document_id uuid,
  document_title text,
  content text,
  similarity float
)
language sql stable
security invoker
set search_path = public
as $$
  select
    c.id as chunk_id,
    c.document_id,
    d.title as document_title,
    c.content,
    1 - (c.embedding <=> query_embedding) as similarity
  from public.knowledge_chunks c
  join public.knowledge_documents d on d.id = c.document_id
  where c.user_id = auth.uid()
  order by c.embedding <=> query_embedding
  limit match_count;
$$;

-- Allow "mentor" mode on sessions (mode is free text, but add a comment)
comment on column public.sessions.mode is 'demartini | goal_clarify | mentor';
