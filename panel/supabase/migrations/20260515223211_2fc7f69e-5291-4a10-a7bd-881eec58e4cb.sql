ALTER TABLE public.payments
  DROP COLUMN IF EXISTS livepix_id,
  DROP COLUMN IF EXISTS pix_payload,
  DROP COLUMN IF EXISTS pix_qr_code;