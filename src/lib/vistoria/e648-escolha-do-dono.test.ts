/*
  E648 (parte 1, aprovado pelo Daniel em 06/11/2026) — REDESENHO DO AVALIADOR (anti-subordinação).
  O sistema SUGERE avaliadores e o DONO ESCOLHE (fim do rodízio designado); a faixa de referência aparece, mas o avaliador
  define o PRÓPRIO PREÇO e o PRÓPRIO PRAZO; o laudo é emitido e ASSINADO pelo avaliador (a Viva fornece o modelo e guarda a
  prova/hash); saem a suspensão automática e o descredenciamento discricionário, entram critérios públicos de qualidade.
  Tudo atrás de VISTORIA_ATIVA (desligada). Roda: node --test src/lib/vistoria/e648-escolha-do-dono.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  CRITERIOS_PUBLICOS,
  FAIXA_REFERENCIA,
  PRAZO_PROPOSTA_MAX_DIAS,
  assinaturaDoLaudo,
  criteriosAtingidos,
  descredenciamentoValido,
  faixaDeReferencia,
  sugerirAvaliadores,
  validarProposta,
} from "./escolha.ts";
import { transicaoCredenciamento, type AvaliadorFila, type PedidoParaDesignar } from "./regras.ts";

const ler = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");
const AGORA = new Date("2026-11-06T12:00:00Z");

const av = (id: string, o: Partial<AvaliadorFila> = {}): AvaliadorFila => ({
  id,
  userId: `u-${id}`,
  cidade: "Uberlândia",
  status: "ativo",
  teste: false,
  credenciadoEm: "2026-01-01T00:00:00Z",
  ultimaDesignacaoEm: null,
  relacoesDonos: [],
  relacoesImoveis: [],
  ...o,
});
const pedido: PedidoParaDesignar = { id: "p1", propertyId: "im1", ownerId: "dono1", cidade: "Uberlândia", tipo: "inicial", teste: false, primeiroAvaliadorId: null, jaDesignados: [] };
const historico = { servicosAoDono: [], avaliacoesDoImovel: [] };

test("o sistema SUGERE todos os elegíveis (não escolhe um): impedidos ficam de fora, com o motivo", () => {
  const r = sugerirAvaliadores([av("a"), av("b"), av("c", { relacoesDonos: ["dono1"] }), av("d", { cidade: "Araguari" })], pedido, historico, AGORA);
  assert.deepEqual(r.sugeridos.map((s) => s.id).sort(), ["a", "b"]);
  assert.deepEqual(r.impedidos, [{ id: "c", motivo: "relacao_declarada" }], "outra cidade nem aparece como impedido");
});

test("a ordem da sugestão é neutra (quem foi menos procurado primeiro) e NUNCA determina quem avalia: sem 'proximo'", () => {
  const r = sugerirAvaliadores([av("a", { ultimaDesignacaoEm: "2026-11-01T00:00:00Z" }), av("b", { ultimaDesignacaoEm: null }), av("c", { ultimaDesignacaoEm: "2026-10-01T00:00:00Z" })], pedido, historico, AGORA);
  assert.deepEqual(r.sugeridos.map((s) => s.id), ["b", "c", "a"]);
  assert.equal("avaliador" in r, false, "nada de 'o próximo designado'");
});

test("sem elegível: lista vazia, o dono vê isso (a Viva não impõe ninguém)", () => {
  const r = sugerirAvaliadores([av("a", { status: "suspenso" })], pedido, historico, AGORA);
  assert.deepEqual(r.sugeridos, []);
});

test("faixa de referência: calculada da tabela, só para exibir — não trava o preço do avaliador", () => {
  const f = faixaDeReferencia(300);
  assert.equal(f.referencia, 300);
  assert.equal(f.min, Math.round(300 * FAIXA_REFERENCIA.abaixo));
  assert.equal(f.max, Math.round(300 * FAIXA_REFERENCIA.acima));
  assert.ok(f.min < f.referencia && f.referencia < f.max);
});

test("o avaliador define o PRÓPRIO preço e prazo: qualquer valor positivo vale, fora da faixa só é sinalizado", () => {
  const f = faixaDeReferencia(300);
  const dentro = validarProposta({ valor: 300, prazoDias: 5 }, f);
  assert.deepEqual(dentro, { ok: true, valor: 300, prazoDias: 5, foraDaFaixa: false });
  const acima = validarProposta({ valor: 900, prazoDias: 5 }, f);
  assert.deepEqual(acima, { ok: true, valor: 900, prazoDias: 5, foraDaFaixa: true });
  const abaixo = validarProposta({ valor: 50, prazoDias: 2 }, f);
  assert.ok(abaixo.ok && abaixo.foraDaFaixa);
  assert.equal(validarProposta({ valor: 0, prazoDias: 5 }, f).ok, false);
  assert.equal(validarProposta({ valor: -1, prazoDias: 5 }, f).ok, false);
  assert.equal(validarProposta({ valor: Number.NaN, prazoDias: 5 }, f).ok, false);
  assert.equal(validarProposta({ valor: 300, prazoDias: 0 }, f).ok, false);
  assert.equal(validarProposta({ valor: 300, prazoDias: 2.5 }, f).ok, false);
  assert.equal(validarProposta({ valor: 300, prazoDias: PRAZO_PROPOSTA_MAX_DIAS + 1 }, f).ok, false);
  assert.ok(validarProposta({ valor: 300.456, prazoDias: 3 }, f).ok && (validarProposta({ valor: 300.456, prazoDias: 3 }, f) as { valor: number }).valor === 300.46, "centavos arredondados");
});

test("assinatura do laudo: feita pelo avaliador (declaração), com hash que prende conteúdo + autor + momento", () => {
  const base = { pdfSha256: "a".repeat(64), avaliadorUserId: "u1", numeroCredenciado: "UDI-001", nomePublico: "Ana", cnpj: "11222333000181", em: "2026-11-06T12:00:00.000Z", declarou: true };
  const s = assinaturaDoLaudo(base);
  assert.ok(s.ok);
  if (!s.ok) return;
  assert.match(s.hash, /^[0-9a-f]{64}$/);
  assert.match(s.termo, /assino/i);
  assert.equal(s.em, base.em);
  const outro = assinaturaDoLaudo({ ...base, pdfSha256: "b".repeat(64) });
  assert.ok(outro.ok && outro.hash !== s.hash, "mudou o PDF, mudou o hash");
  const outroAutor = assinaturaDoLaudo({ ...base, avaliadorUserId: "u2" });
  assert.ok(outroAutor.ok && outroAutor.hash !== s.hash);
  assert.deepEqual(assinaturaDoLaudo({ ...base }), s, "determinística");
  const sem = assinaturaDoLaudo({ ...base, declarou: false });
  assert.equal(sem.ok, false, "sem a declaração do avaliador não há assinatura");
  assert.equal(assinaturaDoLaudo({ ...base, cnpj: "" }).ok, false, "assina como empresa: precisa do CNPJ");
});

test("critérios de qualidade são PÚBLICOS e objetivos; atingi-los só abre uma REVISÃO, nunca muda o status sozinho", () => {
  assert.ok(CRITERIOS_PUBLICOS.length >= 3);
  const ids = new Set(CRITERIOS_PUBLICOS.map((c) => c.id));
  assert.equal(ids.size, CRITERIOS_PUBLICOS.length);
  for (const c of CRITERIOS_PUBLICOS) {
    assert.ok(c.texto.length > 20, c.id);
    assert.ok(Number.isFinite(c.limite) && c.limite > 0, c.id);
  }
  const nada = criteriosAtingidos({ ausenciasSemAviso90d: 1, naoConfere12m: 1, laudosForaDoPrazo180d: 0, notaConduta: 4.5, avaliacoesConduta: 20 });
  assert.deepEqual(nada, []);
  const varios = criteriosAtingidos({ ausenciasSemAviso90d: 3, naoConfere12m: 2, laudosForaDoPrazo180d: 3, notaConduta: 2, avaliacoesConduta: 10 });
  assert.deepEqual(varios.sort(), ["ausencia_sem_aviso", "conduta_baixa", "laudo_fora_do_prazo", "nao_confere_auditoria"]);
  const poucas = criteriosAtingidos({ ausenciasSemAviso90d: 0, naoConfere12m: 0, laudosForaDoPrazo180d: 0, notaConduta: 1, avaliacoesConduta: 2 });
  assert.deepEqual(poucas, [], "nota baixa com poucas avaliações não vale (amostra pequena)");
});

test("descredenciar exige critério público + motivo; 'a Viva quis' não vale; o avaliador tem direito de resposta", () => {
  assert.equal(descredenciamentoValido({ criterioId: null, motivo: "não gostei" }).ok, false);
  assert.equal(descredenciamentoValido({ criterioId: "inventado", motivo: "x".repeat(30) }).ok, false);
  assert.equal(descredenciamentoValido({ criterioId: "ausencia_sem_aviso", motivo: "curto" }).ok, false);
  const ok = descredenciamentoValido({ criterioId: "ausencia_sem_aviso", motivo: "Faltou à visita de 03/11 sem avisar o proprietário." });
  assert.equal(ok.ok, true);
  assert.equal(ok.ok && ok.direitoDeRespostaDias > 0, true);
});

test("a máquina de estados: some a suspensão (automática ou do admin); o descredenciamento segue possível (com critério)", () => {
  assert.equal(transicaoCredenciamento("ativo", "suspenso").ok, false);
  assert.equal(transicaoCredenciamento("ativo", "descredenciado").ok, true);
  assert.equal(transicaoCredenciamento("em_teste", "ativo").ok, true);
  assert.equal(transicaoCredenciamento("suspenso", "ativo").ok, true, "quem já estava suspenso (legado) pode voltar");
});

test("o servidor: nada de suspensão automática, nada de designar sozinho; o dono escolhe, o avaliador propõe, o dono aceita", () => {
  const srv = ler("./servidor.ts").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
  assert.doesNotMatch(srv, /suspendePorAusencias/);
  assert.doesNotMatch(srv, /status: "suspenso"/);
  assert.doesNotMatch(srv, /proximoAvaliador/);
  const act = ler("./actions.ts").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
  for (const f of ["escolherAvaliador", "proporPrecoEPrazo", "aceitarProposta", "recusarProposta"]) assert.match(act, new RegExp(`export async function ${f}\\(`), f);
  assert.doesNotMatch(act, /await designar\(/, "o pedido não é mais designado pela Viva");
  assert.match(act, /descredenciamentoValido\(/, "descredenciar passa pelos critérios públicos");
  const laudo = ler("./laudo-actions.ts");
  assert.equal((laudo.match(/declarou: form\.get\("assino"\) === "on"/g) ?? []).length, 2, "enviar o laudo e confirmar a correção exigem a assinatura do avaliador");
  const emissao = ler("./laudo-servidor.ts");
  assert.match(emissao, /assinaturaDoLaudo\(/);
  assert.match(emissao, /assinatura_hash: assinatura\.hash/);
});

test("migração 0313: colunas da proposta e da assinatura, idempotente, registrada e com rollback; sem tocar em pagamento", () => {
  const mig = ler("../../../supabase/migrations/0313_avaliador_escolha_do_dono_e648.sql");
  const ap = ler("../../../supabase/producao/aplicar-0313.sql");
  const rb = ler("../../../supabase/producao/rollback/0313_rollback.sql");
  for (const c of ["valor_proposto", "prazo_proposto_dias", "proposta_em", "proposta_aceita_em", "escolhido_em"]) assert.match(mig, new RegExp(c), c);
  for (const c of ["assinado_em", "assinatura_hash", "assinatura_termo", "assinado_por"]) assert.match(mig, new RegExp(c), c);
  assert.match(ap, /^begin;/m);
  assert.match(ap, /commit;\s*$/);
  assert.match(ap, /schema_migrations/);
  assert.match(ap, /0313_avaliador_escolha_do_dono_e648/);
  assert.match(ap, /if not exists/i);
  assert.match(rb, /0313/);
  const semComentario = (t: string) => t.replace(/^--.*$/gm, "");
  assert.doesNotMatch(semComentario(mig + ap + rb), /\b(payments?|pagamentos?|invoices?|cobrancas?|contratos?)\b/i, "sem tocar em fluxo de pagamento");
});
