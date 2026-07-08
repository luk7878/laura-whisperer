
-- Restrict clarity_slot_state: remove public readability. It will now be fetched via a public server route using the service role.
DROP POLICY IF EXISTS "Anyone can read slot state" ON public.clarity_slot_state;

-- Revoke EXECUTE on SECURITY DEFINER booking function from anon/authenticated.
-- The RPC is only called server-side via the service-role client.
REVOKE EXECUTE ON FUNCTION public.book_clarity_slot(text, text, text, timestamptz, boolean) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.book_clarity_slot(text, text, text, timestamptz, boolean) FROM anon;
REVOKE EXECUTE ON FUNCTION public.book_clarity_slot(text, text, text, timestamptz, boolean) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.book_clarity_slot(text, text, text, timestamptz, boolean) TO service_role;
