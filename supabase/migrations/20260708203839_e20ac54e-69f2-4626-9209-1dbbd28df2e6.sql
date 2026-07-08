
CREATE TABLE public.clarity_slot_state (
  id smallint PRIMARY KEY DEFAULT 1,
  capacity integer NOT NULL DEFAULT 30 CHECK (capacity >= 0),
  filled integer NOT NULL DEFAULT 0 CHECK (filled >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT single_row CHECK (id = 1)
);

GRANT SELECT ON public.clarity_slot_state TO anon;
GRANT SELECT ON public.clarity_slot_state TO authenticated;
GRANT ALL ON public.clarity_slot_state TO service_role;

ALTER TABLE public.clarity_slot_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read slot state"
  ON public.clarity_slot_state FOR SELECT
  USING (true);

INSERT INTO public.clarity_slot_state (id, capacity, filled) VALUES (1, 30, 0)
  ON CONFLICT (id) DO NOTHING;

CREATE TABLE public.clarity_waitlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  concern text,
  status text NOT NULL DEFAULT 'waiting',
  notified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.clarity_waitlist TO authenticated;
GRANT ALL ON public.clarity_waitlist TO service_role;

ALTER TABLE public.clarity_waitlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage waitlist"
  ON public.clarity_waitlist FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'::app_role))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.book_clarity_slot(
  p_name text,
  p_email text,
  p_concern text,
  p_scheduled_at timestamptz,
  p_consent_accepted boolean
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_state public.clarity_slot_state%ROWTYPE;
  v_booking_id uuid;
  v_access_token text;
  v_waitlist_id uuid;
BEGIN
  SELECT * INTO v_state FROM public.clarity_slot_state WHERE id = 1 FOR UPDATE;

  IF v_state.filled < v_state.capacity THEN
    INSERT INTO public.clarity_bookings (name, email, concern, scheduled_at, consent_accepted, status)
    VALUES (p_name, p_email, p_concern, p_scheduled_at, p_consent_accepted, 'booked')
    RETURNING id, access_token INTO v_booking_id, v_access_token;

    UPDATE public.clarity_slot_state
      SET filled = filled + 1, updated_at = now()
      WHERE id = 1;

    RETURN jsonb_build_object('waitlisted', false, 'id', v_booking_id, 'access_token', v_access_token);
  ELSE
    INSERT INTO public.clarity_waitlist (name, email, concern)
    VALUES (p_name, p_email, p_concern)
    RETURNING id INTO v_waitlist_id;

    RETURN jsonb_build_object('waitlisted', true, 'waitlist_id', v_waitlist_id);
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.book_clarity_slot(text, text, text, timestamptz, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.book_clarity_slot(text, text, text, timestamptz, boolean) TO service_role;
