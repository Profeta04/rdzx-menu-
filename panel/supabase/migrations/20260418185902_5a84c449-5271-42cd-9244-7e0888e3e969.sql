-- Função para incrementar créditos do revendedor
CREATE OR REPLACE FUNCTION public.increment_reseller_credits(reseller_uuid UUID, amount_to_add INTEGER)
RETURNS VOID AS $$
BEGIN
  UPDATE public.resellers
  SET credits = COALESCE(credits, 0) + amount_to_add,
      updated_at = now()
  WHERE id = reseller_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
