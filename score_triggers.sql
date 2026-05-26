-- ================================================================
-- Pato AI — Score & Selos Automáticos
-- Execute no SQL Editor do Supabase:
-- https://supabase.com/dashboard/project/hbiifqlyynddfvgabkjf/sql/new
-- ================================================================

-- ────────────────────────────────────────────────────────────
-- 1. FUNÇÃO PRINCIPAL: recalcular score e seal de um usuário
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.recalcular_score(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_avg_nota      NUMERIC := 0;
  v_concluidos    INTEGER := 0;
  v_total_cands   INTEGER := 0;
  v_respondidas   INTEGER := 0;
  v_resp_rate     NUMERIC := 0;
  v_score_05      NUMERIC := 0;
  v_score_100     INTEGER := 0;
  v_seal          TEXT    := 'bronze';
BEGIN
  -- 1. Média das avaliações recebidas (escala 0–5)
  SELECT COALESCE(AVG(nota), 0)
  INTO v_avg_nota
  FROM avaliacoes
  WHERE avaliado_id = p_user_id;

  -- 2. Bicos concluídos (posts próprios fechados/concluídos)
  SELECT COUNT(*)
  INTO v_concluidos
  FROM posts
  WHERE user_id = p_user_id
    AND status IN ('concluido', 'fechado');

  -- 3. Taxa de resposta como prestador
  SELECT COUNT(*) INTO v_total_cands
  FROM candidaturas WHERE prestador_id = p_user_id;

  SELECT COUNT(*) INTO v_respondidas
  FROM candidaturas WHERE prestador_id = p_user_id
    AND status NOT IN ('pendente');

  IF v_total_cands > 0 THEN
    v_resp_rate := v_respondidas::NUMERIC / v_total_cands::NUMERIC;
  ELSE
    v_resp_rate := 0; -- sem histórico = sem bônus de resposta
  END IF;

  -- 4. Score final (escala 0–5):
  --    50% média notas + 30% bicos concluídos (cap 50) + 20% taxa resposta
  v_score_05 :=
    (v_avg_nota                                    * 0.5) +
    (LEAST(v_concluidos, 50)::NUMERIC / 50.0 * 5.0 * 0.3) +
    (v_resp_rate * 5.0                             * 0.2);

  -- Converter para escala 0–100 (compatível com Stars existente)
  v_score_100 := ROUND(v_score_05 * 20)::INTEGER;

  -- 5. Seal baseado em bicos concluídos
  IF v_concluidos >= 51 THEN
    v_seal := 'ouro';
  ELSIF v_concluidos >= 11 THEN
    v_seal := 'prata';
  ELSE
    v_seal := 'bronze';
  END IF;

  -- 6. Atualizar perfil
  UPDATE profiles
  SET
    score      = v_score_100,
    seal       = v_seal,
    concluidos = v_concluidos
  WHERE id = p_user_id;

EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'recalcular_score error for %: %', p_user_id, SQLERRM;
END;
$$;

-- ────────────────────────────────────────────────────────────
-- 2. TRIGGER: nova avaliação → recalcular avaliado
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.trg_fn_avaliacao_recalc()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.recalcular_score(NEW.avaliado_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_avaliacao_recalc ON avaliacoes;
CREATE TRIGGER trg_avaliacao_recalc
  AFTER INSERT OR UPDATE ON avaliacoes
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_fn_avaliacao_recalc();

-- ────────────────────────────────────────────────────────────
-- 3. TRIGGER: post fechado/concluído → recalcular dono
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.trg_fn_post_concluido_recalc()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IN ('concluido', 'fechado')
     AND (OLD.status IS NULL OR OLD.status NOT IN ('concluido', 'fechado'))
  THEN
    PERFORM public.recalcular_score(NEW.user_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_post_concluido_recalc ON posts;
CREATE TRIGGER trg_post_concluido_recalc
  AFTER INSERT OR UPDATE ON posts
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_fn_post_concluido_recalc();

-- ────────────────────────────────────────────────────────────
-- 4. RECALCULAR TODOS OS USUÁRIOS EXISTENTES (rode uma vez)
-- ────────────────────────────────────────────────────────────
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id FROM profiles LOOP
    PERFORM public.recalcular_score(r.id);
  END LOOP;
END;
$$;
