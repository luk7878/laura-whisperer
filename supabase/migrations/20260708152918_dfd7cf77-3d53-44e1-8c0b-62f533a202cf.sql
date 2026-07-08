ALTER TABLE public.clarity_bookings
  ADD COLUMN IF NOT EXISTS human_session_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS human_session_preferred_at timestamptz,
  ADD COLUMN IF NOT EXISTS human_session_note text;