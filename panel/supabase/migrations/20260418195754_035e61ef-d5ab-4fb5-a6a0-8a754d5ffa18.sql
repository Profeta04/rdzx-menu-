ALTER TABLE public.reseller_credit_transactions
ADD COLUMN token_type TEXT DEFAULT 'monthly' CHECK (token_type IN ('7d', 'monthly', 'annual', 'lifetime'));

-- Update existing transactions
UPDATE public.reseller_credit_transactions SET token_type = 'monthly';
