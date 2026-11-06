-- Primeiro, garantir que a função de validação de licença no banco de dados respeite a trava estrita.
-- (Esta lógica já existe parcialmente na função validate-license, mas vamos reforçar a regra de negócio na tabela)

-- Adicionar um comentário de regra de negócio na tabela para auditoria
COMMENT ON COLUMN public.licenses.device_id IS 'ID único do hardware vinculado. Uma vez definido, impede o uso em outros dispositivos (Trava de 1-para-1).';

-- Nota: A implementação no backend (Edge Functions) já foi reforçada no passo anterior.
-- Agora vamos garantir que a função RPC de incremento de prompts e outras interações não permitam bypass.

-- Atualizar a função validate-license para ser mais punitiva em caso de tentativa de troca de device_id
-- (O código da Edge Function 'validate-license' deve ser atualizado para tratar 'device_conflict' como erro fatal)
