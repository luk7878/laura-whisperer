ALTER TABLE public.clarity_bookings 
  ADD COLUMN IF NOT EXISTS helpfulness_rating smallint CHECK (helpfulness_rating BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS contact_email text;