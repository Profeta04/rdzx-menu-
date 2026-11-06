-- Tabela de pacotes de créditos
CREATE TABLE public.reseller_credit_packages (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    credits INTEGER NOT NULL,
    price NUMERIC(10, 2) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabela de transações de créditos
CREATE TABLE public.reseller_credit_transactions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    reseller_id UUID NOT NULL REFERENCES public.resellers(id) ON DELETE CASCADE,
    package_id UUID REFERENCES public.reseller_credit_packages(id) ON DELETE SET NULL,
    amount INTEGER NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('purchase', 'usage', 'adjustment')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
    payment_id UUID, -- Referência opcional à tabela payments
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Adicionar colunas necessárias na tabela de pagamentos
ALTER TABLE public.payments 
ADD COLUMN IF NOT EXISTS reseller_id UUID REFERENCES public.resellers(id),
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Habilitar RLS
ALTER TABLE public.reseller_credit_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reseller_credit_transactions ENABLE ROW LEVEL SECURITY;

-- Políticas para reseller_credit_packages (Qualquer um logado pode ver pacotes ativos)
CREATE POLICY "Anyone can view active credit packages" 
ON public.reseller_credit_packages 
FOR SELECT 
USING (is_active = true);

-- Políticas para reseller_credit_transactions
CREATE POLICY "Resellers can view their own transactions" 
ON public.reseller_credit_transactions 
FOR SELECT 
USING (
    auth.uid() IN (
        SELECT user_id FROM public.resellers WHERE id = reseller_id
    )
);

-- Políticas para a tabela resellers (Saldo)
-- Já deve existir, mas garantimos que o reseller veja seu próprio saldo
CREATE POLICY "Resellers can view their own data" 
ON public.resellers 
FOR SELECT 
USING (auth.uid() = user_id);

-- Inserir alguns pacotes padrão
INSERT INTO public.reseller_credit_packages (name, credits, price) VALUES
('Pacote Básico (100 Créditos)', 100, 50.00),
('Pacote Intermediário (500 Créditos)', 500, 200.00),
('Pacote Profissional (1500 Créditos)', 1500, 500.00);
