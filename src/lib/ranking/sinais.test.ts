import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sinaisDaLinha, type LinhaRankingSinais } from "./sinais.ts";

const linha = (o: Partial<LinhaRankingSinais> = {}): LinhaRankingSinais => ({
  id: "10000000-0000-4000-8000-000000000001",
  dono_id: "d1",
  titulo: "Apartamento no Centro",
  dono_is_teste: false,
  fotos_total: 12,
  comodos_distintos: 5,
  descricao_palavras: 80,
  regras_completas: true,
  endereco_exato: true,
  disponibilidade_confirmada_em: "2026-10-20T12:00:00Z",
  matricula_conferida: true,
  caf_real_ok: false,
  conversas: 4,
  conversas_respondidas: 4,
  resposta_media_min: 30,
  avaliacoes_qtd: 2,
  avaliacoes_media: "4.5000000000000000",
  cancelamentos_dono_12m: 0,
  preco_justo: true,
  ...o,
});

test("linha do banco vira sinais; numeric em texto vira número; nulos viram 0/null", () => {
  const s = sinaisDaLinha(linha(), { identidadeConfirmada: true });
  assert.equal(s.avaliacoesMedia, 4.5);
  assert.equal(s.identidadeConfirmada, true);
  assert.equal(s.fotosDeParceiro, false, "sem o 31b no ar, ninguém tem fotos de parceiro");
  const vazio = sinaisDaLinha(linha({ fotos_total: null, avaliacoes_media: null, resposta_media_min: null, conversas: null }), { identidadeConfirmada: false });
  assert.equal(vazio.fotosTotal, 0);
  assert.equal(vazio.avaliacoesMedia, null);
  assert.equal(vazio.respostaMediaMin, null);
  assert.equal(vazio.conversas, 0);
});

test("teste: marca no título OU conta de teste; anúncio do banco nunca é exemplo", () => {
  assert.equal(sinaisDaLinha(linha({ titulo: "[TESTE QA] Studio" }), { identidadeConfirmada: false }).ehTeste, true);
  assert.equal(sinaisDaLinha(linha({ dono_is_teste: true }), { identidadeConfirmada: false }).ehTeste, true);
  assert.equal(sinaisDaLinha(linha(), { identidadeConfirmada: false }).ehExemplo, false);
});

test("identidade: estado do perfil ou CAF real (o simulado já vem fora em caf_real_ok)", () => {
  assert.equal(sinaisDaLinha(linha({ caf_real_ok: true }), { identidadeConfirmada: false }).identidadeConfirmada, true);
  assert.equal(sinaisDaLinha(linha({ caf_real_ok: false }), { identidadeConfirmada: false }).identidadeConfirmada, false);
});

test("GUARDA: ranking_sinais (0196) não lê nenhum campo de plano ou cobrança", () => {
  const sql = readFileSync("supabase/migrations/0196_ranking_sinais.sql", "utf8");
  const funcao = sql.slice(sql.indexOf("create or replace function public.ranking_sinais"));
  const semComentarios = funcao.replace(/--.*$/gm, "");
  assert.doesNotMatch(semComentarios, /plan|pago|pagamento|assinatura|cobranca|taxa|comiss|aluguel_mensal|stripe|patrocin/i);
});
