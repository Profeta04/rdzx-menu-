
CREATE TABLE public.proxies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host text NOT NULL,
  port integer NOT NULL,
  username text,
  password text,
  protocol text NOT NULL DEFAULT 'http',
  country text,
  city text,
  active boolean NOT NULL DEFAULT true,
  last_checked timestamptz,
  last_status text,
  last_egress_ip text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (host, port)
);

CREATE INDEX idx_proxies_active ON public.proxies (active) WHERE active = true;

ALTER TABLE public.proxies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage proxies"
ON public.proxies
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE TRIGGER trg_proxies_updated_at
BEFORE UPDATE ON public.proxies
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
