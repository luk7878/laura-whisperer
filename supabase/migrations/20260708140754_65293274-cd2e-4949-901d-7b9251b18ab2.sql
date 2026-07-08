
-- Public "clarity" booking flow tables
CREATE TABLE public.clarity_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  access_token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  concern text,
  scheduled_at timestamptz,
  consent_accepted boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'booked',
  emotional_start smallint,
  emotional_end smallint,
  safety_triggered boolean NOT NULL DEFAULT false,
  safety_reason text,
  summary jsonb,
  feedback text,
  wants_subscription boolean NOT NULL DEFAULT false,
  wants_human_session boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz
);

GRANT ALL ON public.clarity_bookings TO service_role;
ALTER TABLE public.clarity_bookings ENABLE ROW LEVEL SECURITY;
-- No policies: all access goes through server functions using service_role,
-- which validate the access_token from the URL.

CREATE TABLE public.clarity_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.clarity_bookings(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user','assistant','system')),
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.clarity_messages TO service_role;
ALTER TABLE public.clarity_messages ENABLE ROW LEVEL SECURITY;
-- No policies: access via server functions only.

CREATE INDEX clarity_messages_booking_idx ON public.clarity_messages(booking_id, created_at);
CREATE INDEX clarity_bookings_token_idx ON public.clarity_bookings(access_token);

CREATE TRIGGER clarity_bookings_updated_at
  BEFORE UPDATE ON public.clarity_bookings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
