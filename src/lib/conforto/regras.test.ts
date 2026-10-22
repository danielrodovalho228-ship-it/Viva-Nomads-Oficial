/*
  Prompt 59, Parte A — padrão mínimo de conforto. Roda: node --test src/lib/conforto/regras.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CHAVES_CONFORTO, ITENS_CONFORTO, PRAZO_ADEQUACAO_DIAS, VERSAO_CONFORTO } from "../../config/conforto-minimo.ts";
import {
  CONFIRMACAO_PENDENCIA_H,
  PRAZO_CORRECAO_H,
  correcaoConfirmadaPorPrazo,
  deveSairDaBusca,
  estadoConfortoMinimo,
  itensFaltantes,
  lembreteAdequacao,
  linhasConfirmacao,
  pendenciaFechada,
  pendenciaVencida,
  pendenciasDaConferencia,
  podePublicarConforto,
  prazoAdequacao,
  procedentes12m,
  seloPeloConforto,
  transicaoPendencia,
  validarSecaoConforto,
  type PendenciaConforto,
} from "./regras.ts";
import { PRAZO_SOLUCAO_H } from "../../config/atendimento.ts";
import { notaQualidade, selosDoAnuncio, type SinaisAnuncio } from "../ranking/ordem.ts";

const AGORA = new Date("2026-10-22T15:00:00Z");
const H = 3_600_000;
const D = 86_400_000;
const todas = CHAVES_CONFORTO.map((chave) => ({ chave, confirmado: true, versao_lista: VERSAO_CONFORTO }));

test("lista única: 10 itens com chave, rótulo e critério; ar-condicionado não é exigido (D5)", () => {
  assert.deepEqual([...CHAVES_CONFORTO], [
    "cama_colchao", "roupa_cama_banho", "agua_quente", "cozinha_basica", "ventilacao_quartos",
    "iluminacao", "fechadura_entrada", "entrega_limpa", "internet_informada", "mobilia_das_fotos",
  ]);
  for (const i of ITENS_CONFORTO) assert.ok(i.rotulo && i.criterio && i.desdeVersao >= 1, i.chave);
  const vent = ITENS_CONFORTO.find((i) => i.chave === "ventilacao_quartos")!;
  assert.match(vent.criterio, /Ar-condicionado não é exigido/);
  assert.equal(VERSAO_CONFORTO, 1);
});

test("versão da lista: item novo pede reconfirmação só dele; os confirmados antes continuam valendo", () => {
  assert.deepEqual(itensFaltantes(todas), []);
  // Uma declaração de item que saiu da lista é ignorada; um item que não tem declaração (novo) falta.
  const semUm = todas.filter((d) => d.chave !== "agua_quente").concat([{ chave: "item_antigo", confirmado: true, versao_lista: 0 }]);
  assert.deepEqual(itensFaltantes(semUm), ["agua_quente"]);
  // Desconfirmado conta como faltando.
  assert.deepEqual(itensFaltantes(todas.map((d) => (d.chave === "iluminacao" ? { ...d, confirmado: false } : d))), ["iluminacao"]);
  const linhas = linhasConfirmacao("p1", ["agua_quente", "agua_quente", "invasor"], "dono", AGORA);
  assert.deepEqual(linhas, [{ property_id: "p1", chave: "agua_quente", confirmado: true, confirmado_por: "dono", confirmado_em: AGORA.toISOString(), versao_lista: 1 }]);
});

test("bloqueio de publicação: 1 item faltando recusa com a lista do que falta", () => {
  assert.deepEqual(podePublicarConforto(todas), { ok: true });
  const r = podePublicarConforto(todas.filter((d) => d.chave !== "fechadura_entrada"));
  assert.equal(r.ok, false);
  assert.ok(!r.ok && r.faltantes.length === 1 && r.faltantes[0] === "fechadura_entrada");
  assert.ok(!r.ok && r.erro === "Para publicar, confirme o padrão mínimo de conforto: Fechadura na entrada.");
  const nada = podePublicarConforto([]);
  assert.ok(!nada.ok && nada.faltantes.length === 10);
});

test("anúncio já publicado: 30 dias, lembretes aos 15 e aos 3 dias, sai da busca no dia 31 e volta ao confirmar", () => {
  assert.equal(PRAZO_ADEQUACAO_DIAS, 30);
  const prazo = prazoAdequacao(AGORA).toISOString();
  assert.equal(prazo, new Date(AGORA.getTime() + 30 * D).toISOString());
  assert.equal(lembreteAdequacao(prazo, false, new Date(AGORA.getTime() + 15 * D)), 15);
  assert.equal(lembreteAdequacao(prazo, false, new Date(AGORA.getTime() + 27 * D)), 3);
  assert.equal(lembreteAdequacao(prazo, false, new Date(AGORA.getTime() + 10 * D)), null);
  assert.equal(lembreteAdequacao(prazo, true, new Date(AGORA.getTime() + 15 * D)), null);
  const dia30 = new Date(AGORA.getTime() + 30 * D - 1);
  const dia31 = new Date(AGORA.getTime() + 30 * D);
  assert.equal(deveSairDaBusca(prazo, false, dia30), false);
  assert.equal(deveSairDaBusca(prazo, false, dia31), true);
  assert.equal(deveSairDaBusca(prazo, true, dia31), false, "confirmou: volta");
  const e = estadoConfortoMinimo(todas.slice(0, 9), prazo, new Date(AGORA.getTime() + 2 * D));
  assert.equal(e.situacao, "em_adequacao");
  assert.equal(e.aviso, `Confirme o padrão mínimo até ${new Date(prazo).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}`);
  assert.equal(estadoConfortoMinimo(todas.slice(0, 9), prazo, dia31).situacao, "vencido");
  assert.equal(estadoConfortoMinimo(todas, prazo, dia31).situacao, "completo");
  assert.deepEqual(estadoConfortoMinimo([], null, AGORA).faltantes.length, 10);
});

test("conferência de entrada: todos os itens respondidos; 'não confere' pede texto curto, foto opcional; ordem fixa", () => {
  const tudoConfere = CHAVES_CONFORTO.map((chave) => ({ chave, confere: true }));
  const ok = validarSecaoConforto([...tudoConfere].reverse());
  assert.ok(ok.ok && ok.respostas.map((r) => r.chave).join() === CHAVES_CONFORTO.join());
  assert.equal(validarSecaoConforto(tudoConfere.slice(1)).ok, false);
  const semTexto = validarSecaoConforto(tudoConfere.map((r) => (r.chave === "agua_quente" ? { ...r, confere: false } : r)));
  assert.ok(!semTexto.ok && /Água quente/.test(semTexto.erro));
  const comTexto = validarSecaoConforto(tudoConfere.map((r) => (r.chave === "agua_quente" ? { chave: r.chave, confere: false, texto: " Chuveiro frio ", foto: "x/1.jpg" } : r)));
  assert.ok(comTexto.ok);
  assert.ok(comTexto.ok && comTexto.respostas[2].texto === "Chuveiro frio" && comTexto.respostas[2].foto === "x/1.jpg");
});

test("pendência: prazo de correção = solução da prioridade MÉDIA (72 h)", () => {
  assert.equal(PRAZO_CORRECAO_H, PRAZO_SOLUCAO_H.media);
  assert.equal(PRAZO_CORRECAO_H, 72);
  const [p] = pendenciasDaConferencia([{ chave: "agua_quente", confere: false, texto: "frio" }, { chave: "iluminacao", confere: true }], AGORA);
  assert.equal(p.status, "aberta");
  assert.equal(Date.parse(p.prazo_ate) - AGORA.getTime(), 72 * H);
  assert.ok(pendenciaVencida(p, new Date(AGORA.getTime() + 72 * H)));
  assert.ok(!pendenciaVencida(p, new Date(AGORA.getTime() + 71 * H)));
});

test("pendência: dono corrige → morador confirma ou reabre em 48 h; sem resposta, conta como corrigida", () => {
  const p: PendenciaConforto = { chave: "agua_quente", status: "aberta", aberta_em: AGORA.toISOString(), prazo_ate: new Date(AGORA.getTime() + 72 * H).toISOString() };
  const t1 = new Date(AGORA.getTime() + 10 * H);
  const corr = transicaoPendencia(p, "corrigir", "proprietario", t1)!;
  assert.deepEqual(corr, { status: "corrigida", corrigida_em: t1.toISOString() });
  const corrigida = { ...p, ...corr } as PendenciaConforto;
  assert.equal(transicaoPendencia(p, "corrigir", "inquilino", t1), null, "só o dono corrige");
  assert.deepEqual(transicaoPendencia(corrigida, "confirmar", "inquilino", new Date(t1.getTime() + 47 * H)), { confirmada_em: new Date(t1.getTime() + 47 * H).toISOString() });
  const reab = transicaoPendencia(corrigida, "reabrir", "inquilino", new Date(t1.getTime() + 5 * H))!;
  assert.equal(reab.status, "aberta");
  assert.equal(reab.corrigida_em, null);
  assert.ok(!("prazo_ate" in reab), "reabrir não muda o prazo original");
  assert.equal(CONFIRMACAO_PENDENCIA_H, 48);
  const depois48 = new Date(t1.getTime() + 48 * H);
  assert.equal(transicaoPendencia(corrigida, "confirmar", "inquilino", depois48), null);
  assert.ok(correcaoConfirmadaPorPrazo(corrigida, depois48));
  assert.ok(pendenciaFechada(corrigida, depois48));
  assert.ok(!pendenciaFechada(corrigida, new Date(t1.getTime() + 47 * H)));
});

test("contestação: o dono contesta; só o atendimento da Viva (admin) decide procedente/improcedente", () => {
  const p: PendenciaConforto = { chave: "mobilia_das_fotos", status: "aberta", aberta_em: AGORA.toISOString(), prazo_ate: AGORA.toISOString() };
  const c = { ...p, ...transicaoPendencia(p, "contestar", "proprietario", AGORA)! } as PendenciaConforto;
  assert.equal(c.status, "contestada");
  assert.equal(transicaoPendencia(c, "decidir", "proprietario", AGORA, "improcedente"), null, "o dono nunca decide");
  assert.equal(transicaoPendencia(c, "decidir", "inquilino", AGORA, "procedente"), null);
  assert.equal(transicaoPendencia(c, "decidir", "admin", AGORA), null, "decisão obrigatória");
  assert.deepEqual(transicaoPendencia(c, "decidir", "admin", AGORA, "procedente"), { status: "procedente", decidido_em: AGORA.toISOString() });
  assert.equal(transicaoPendencia(p, "decidir", "admin", AGORA, "procedente"), null, "só decide o que foi contestado");
});

test("selo e nota: 2 procedentes em 12 meses tiram 'Proprietário verificado' e a nota cai; na 1ª, aviso; a janela devolve", () => {
  const proc = (diasAtras: number): PendenciaConforto => ({
    chave: "agua_quente", status: "procedente", aberta_em: new Date(AGORA.getTime() - diasAtras * D).toISOString(),
    prazo_ate: AGORA.toISOString(), decidido_em: new Date(AGORA.getTime() - diasAtras * D).toISOString(),
  });
  assert.equal(procedentes12m([proc(10), proc(200), { ...proc(5), status: "improcedente" }], AGORA), 2);
  assert.equal(procedentes12m([proc(10), proc(400)], AGORA), 1, "fora da janela de 12 meses não conta");
  assert.equal(seloPeloConforto(0), "mantem");
  assert.equal(seloPeloConforto(1), "aviso");
  assert.equal(seloPeloConforto(2), "perde");
  const base: SinaisAnuncio = {
    id: "a", donoId: "d", ehExemplo: false, ehTeste: false, fotosTotal: 10, comodosDistintos: 6, fotosDeParceiro: false,
    descricaoPalavras: 80, regrasCompletas: true, enderecoExato: true, calendarioConfirmadoEm: AGORA.toISOString(),
    identidadeConfirmada: true, matriculaConferida: true, conversas: 0, conversasRespondidas: 0, respostaMediaMin: null,
    avaliacoesQtd: 0, avaliacoesMedia: null, cancelamentosDono12m: 0, precoJusto: false,
  };
  const tem = (s: SinaisAnuncio) => selosDoAnuncio(s).some((x) => x.codigo === "proprietario_verificado");
  assert.ok(tem({ ...base, confortoProcedentes12m: 1 }));
  assert.ok(!tem({ ...base, confortoProcedentes12m: 2 }));
  assert.ok(tem({ ...base, confortoProcedentes12m: procedentes12m([proc(10), proc(400)], AGORA) }), "volta quando a janela deixa de ter 2");
  assert.equal(notaQualidade({ ...base, confortoProcedentes12m: 2 }, AGORA).nota, notaQualidade(base, AGORA).nota - 10);
});

test("nada financeiro (D7): as regras do padrão mínimo e da manutenção não geram valor, multa, abatimento ou rescisão", () => {
  for (const f of ["../../config/conforto-minimo.ts", "./regras.ts", "../manutencao-solucao.ts"]) {
    const fonte = readFileSync(new URL(f, import.meta.url), "utf8").replace(/Nada financeiro[^\n]*/g, "");
    assert.doesNotMatch(fonte, /R\$|multa|abatimento|desconto|reembolso|rescis|valor_|preco|cobran/i, f);
  }
});
