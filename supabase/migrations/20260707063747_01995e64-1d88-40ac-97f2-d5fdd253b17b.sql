
CREATE TABLE public.mentor_threads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Naujas pokalbis',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mentor_threads TO authenticated;
GRANT ALL ON public.mentor_threads TO service_role;
ALTER TABLE public.mentor_threads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own mentor threads" ON public.mentor_threads FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX mentor_threads_user_updated_idx ON public.mentor_threads (user_id, updated_at DESC);
CREATE TRIGGER mentor_threads_updated_at BEFORE UPDATE ON public.mentor_threads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.mentor_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  thread_id UUID NOT NULL REFERENCES public.mentor_threads(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user','assistant')),
  content TEXT NOT NULL,
  sources JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mentor_messages TO authenticated;
GRANT ALL ON public.mentor_messages TO service_role;
ALTER TABLE public.mentor_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own mentor messages" ON public.mentor_messages FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX mentor_messages_thread_idx ON public.mentor_messages (thread_id, created_at);

-- touch thread when message inserted
CREATE OR REPLACE FUNCTION public.touch_mentor_thread() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  UPDATE public.mentor_threads SET updated_at = now() WHERE id = NEW.thread_id;
  RETURN NEW;
END; $$;
CREATE TRIGGER mentor_messages_touch AFTER INSERT ON public.mentor_messages
  FOR EACH ROW EXECUTE FUNCTION public.touch_mentor_thread();
