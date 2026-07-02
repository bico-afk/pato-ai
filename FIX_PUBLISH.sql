-- ============================================================
-- CORREÇÃO: publicar pedidos (demands)
-- Rode isto no Supabase → SQL Editor → Run
-- ============================================================

-- 1) Remove a restrição UNIQUE do anonymous_token.
--    Ela impedia que o MESMO navegador anônimo publicasse mais de um pedido
--    (a 2ª publicação falhava com "duplicate key"). Um usuário anônimo pode
--    ter vários pedidos — o token identifica o navegador, não o pedido.
ALTER TABLE demands DROP CONSTRAINT IF EXISTS demands_anonymous_token_key;

-- 2) Índice (não-único) para consultar rápido "meus pedidos" do anônimo.
CREATE INDEX IF NOT EXISTS idx_demands_anon_token ON demands(anonymous_token);

-- Pronto. Publicação anônima e logada passam a funcionar sem limite.
