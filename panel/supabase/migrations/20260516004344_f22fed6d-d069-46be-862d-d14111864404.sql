
CREATE TABLE IF NOT EXISTS public.admin_telegram (
  user_id uuid PRIMARY KEY,
  chat_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_telegram ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins view own telegram" ON public.admin_telegram;
CREATE POLICY "Admins view own telegram"
  ON public.admin_telegram FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id AND is_admin());

DROP POLICY IF EXISTS "Admins update own telegram" ON public.admin_telegram;
CREATE POLICY "Admins update own telegram"
  ON public.admin_telegram FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id AND is_admin())
  WITH CHECK (auth.uid() = user_id AND is_admin());

DROP TRIGGER IF EXISTS trg_admin_telegram_updated ON public.admin_telegram;
CREATE TRIGGER trg_admin_telegram_updated
  BEFORE UPDATE ON public.admin_telegram
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.admin_otp_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  code_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  used boolean NOT NULL DEFAULT false,
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_otp_codes_user_active 
  ON public.admin_otp_codes (user_id, used, expires_at);

ALTER TABLE public.admin_otp_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "No direct access to admin_otp_codes" ON public.admin_otp_codes;
CREATE POLICY "No direct access to admin_otp_codes"
  ON public.admin_otp_codes FOR ALL
  TO public
  USING (false)
  WITH CHECK (false);

INSERT INTO public.admin_telegram (user_id, chat_id)
SELECT id, '79843409662' FROM auth.users WHERE email = 'rodrigobrian152@gmail.com'
ON CONFLICT (user_id) DO UPDATE SET chat_id = EXCLUDED.chat_id, updated_at = now();
