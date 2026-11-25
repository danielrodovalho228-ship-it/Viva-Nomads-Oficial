import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PRAZO_RESPOSTA_PADRAO_HORAS, horasDeResposta } from "./prazos.ts";
import { relogioDoPedido, rotuloSemResposta, textoDasAvaliacoesNaoLidas, textoDoHistoricoVazio } from "./relogio-do-pedido.ts";
import { designacaoVencida } from "./regras.ts";
import { RESPOSTA_DO_AVALIADOR } from "./rotulos-do-pedido.ts";
import { fonteSemComentarios as semComentarios } from "../fonte-sem-comentarios.ts";

/*
  E1157 (ORDEM-DUET-654, P2 da varredura das telas do parceiro; ORDEM-DUET-658, A1 da tela da equipe). O avaliador
  declara em "Meus termos" em quantas horas responde (até 72), e é esse prazo que a rotina usa para devolver o pedido
  ao dono. Mas quatro textos diziam sempre "24 horas": o rótulo do histórico, o vazio do histórico e o aviso de leitura
  falhada, na tela do avaliador; e o rótulo das recusas, na tela da equipe. Com 48 horas declaradas, a tela dizia 24.
  Passam a ler o prazo declarado por esse avaliador (sem declaração, o padrão), de uma função só.
  Roda: node --test src/lib/vistoria/e1157-prazo-de-resposta-declarado.test.ts
*/
const ler = (p: string) => readFileSync(p, "utf8");
// Só os comentários de JSX, os blocos que começam a linha e as linhas "//": numa página, `accept="image/*"` não abre comentário.

test("E1157: o prazo que vale é o declarado; sem declaração (ou com valor inválido), o padrão", () => {
  assert.equal(horasDeResposta(48), 48);
  assert.equal(horasDeResposta(72), 72);
  assert.equal(horasDeResposta(1), 1);
  for (const vazio of [null, undefined, 0, -3, Number.NaN]) assert.equal(horasDeResposta(vazio), PRAZO_RESPOSTA_PADRAO_HORAS, String(vazio));
  // É o mesmo prazo que o relógio do pedido e a rotina usam: com 48 horas declaradas, às 30 horas ainda não venceu.
  const escolha = "2026-11-24T00:00:00.000Z";
  const as30h = new Date("2026-11-25T06:00:00.000Z");
  const estado = { status: "designado", resposta: null, designadoEm: escolha, propostaEm: null, propostaAceitaEm: null, precisaDoAceite: true };
  assert.equal(relogioDoPedido({ ...estado, prazoRespostaHoras: 48 }, as30h)!.vencido, false);
  assert.equal(relogioDoPedido({ ...estado, prazoRespostaHoras: 48 }, as30h)!.horas, horasDeResposta(48));
  assert.equal(relogioDoPedido({ ...estado, prazoRespostaHoras: null }, as30h)!.vencido, true);
  assert.equal(designacaoVencida(escolha, as30h, horasDeResposta(48)), false);
  assert.equal(designacaoVencida(escolha, as30h, horasDeResposta(null)), true);
});

test("E1157: os textos dizem o prazo declarado — 48 horas para quem declarou 48, e não 24", () => {
  assert.equal(rotuloSemResposta(48), "Sem resposta em 48 horas");
  assert.equal(textoDoHistoricoVazio(48), "Aqui ficam as avaliações que você concluiu, as que recusou, as que passaram de 48 horas sem resposta e as ausências registradas. Ainda não há nenhuma.");
  assert.equal(textoDasAvaliacoesNaoLidas(48), "Não foi possível carregar as suas avaliações agora. Recarregue a página em instantes; os pedidos com prazo de 48 h continuam valendo.");
  for (const t of [rotuloSemResposta(48), textoDoHistoricoVazio(48), textoDasAvaliacoesNaoLidas(48)]) assert.doesNotMatch(t, /\b24\b/);
  // Sem declaração, os textos ficam como eram (o padrão).
  assert.equal(rotuloSemResposta(null), "Sem resposta em 24 horas");
  assert.equal(textoDoHistoricoVazio(undefined), "Aqui ficam as avaliações que você concluiu, as que recusou, as que passaram de 24 horas sem resposta e as ausências registradas. Ainda não há nenhuma.");
  assert.equal(textoDasAvaliacoesNaoLidas(null), "Não foi possível carregar as suas avaliações agora. Recarregue a página em instantes; os pedidos com prazo de 24 h continuam valendo.");
  // Uma hora declarada: singular.
  assert.equal(rotuloSemResposta(1), "Sem resposta em 1 hora");
  assert.match(textoDoHistoricoVazio(1), /as que passaram de 1 hora sem resposta/);
});

test("E1157: a tela do avaliador lê os três textos do prazo que ELE declarou", () => {
  const pagina = semComentarios(ler("src/app/(dashboard)/dashboard/parceiro/avaliacao/page.tsx"));
  assert.match(pagina, /const MSG_AVALIACOES_FALHOU = textoDasAvaliacoesNaoLidas\(cred\.prazo_resposta_horas\);/);
  // E1158 (17; ORDEM-DUET-658): as outras duas respostas vêm da fonte das duas vozes; "expirada" continua a ler o prazo declarado.
  assert.match(pagina, /const ROTULO_RESPOSTA: Record<string, string> = \{ \.\.\.RESPOSTA_DO_AVALIADOR\.avaliador, expirada: rotuloSemResposta\(cred\.prazo_resposta_horas\) \};/);
  assert.match(pagina, /<p [^>]*data-testid="avaliacoes-historico-vazio"[^>]*>\s*\{textoDoHistoricoVazio\(cred\.prazo_resposta_horas\)\}\s*<\/p>/);
  // Nenhum dos três continua a escrever o padrão: o padrão só entra em "Meus termos", como valor inicial do campo.
  assert.equal((pagina.match(/PRAZO_RESPOSTA_PADRAO_HORAS/g) ?? []).length, 2, "a importação e o valor inicial do campo de Meus termos");
  assert.match(pagina, /defaultValue=\{cred\.prazo_resposta_horas \?\? PRAZO_RESPOSTA_PADRAO_HORAS\}/);
  assert.doesNotMatch(pagina, /Sem resposta em|horas sem resposta|continuam valendo/, "os textos saem de relogio-do-pedido");
});

test("E1157: a tela da equipe lê o prazo declarado de CADA avaliador no rótulo das recusas", () => {
  const admin = semComentarios(ler("src/app/(dashboard)/admin/avaliadores/page.tsx"));
  assert.match(admin, /\.from\("avaliadores_credenciamento"\)\.select\("[^"]*\bprazo_resposta_horas\b[^"]*"\)/);
  assert.match(admin, /const prazoRespostaDe = new Map\(lista\.map\(\(c\) => \[c\.id, c\.prazo_resposta_horas\]\)\);/);
  assert.match(admin, /\{r\.resposta === "expirada" \? rotuloSemResposta\(prazoRespostaDe\.get\(r\.avaliador_id\)\) : \(ROTULO_RESPOSTA\[r\.resposta\] \?\? r\.resposta\)\}/);
  assert.doesNotMatch(admin, /PRAZO_RESPOSTA_PADRAO_HORAS|Sem resposta em/, "a equipe já não escreve o padrão à mão");
  // As duas outras respostas ficam com os rótulos da equipe.
  // E1158 (17; ORDEM-DUET-658): os rótulos da equipe vêm da fonte das duas vozes.
  assert.match(admin, /const ROTULO_RESPOSTA = RESPOSTA_DO_AVALIADOR\.equipe;/);
  assert.deepEqual(RESPOSTA_DO_AVALIADOR.equipe, { recusada: "Recusou", ausencia: "Não foi à visita" });
});

test("E1157: o relógio do pedido usa a mesma função — uma regra só para o prazo que vale", () => {
  const relogio = semComentarios(ler("src/lib/vistoria/relogio-do-pedido.ts"));
  assert.match(relogio, /return relogio\("avaliador", p\.designadoEm, horasDeResposta\(p\.prazoRespostaHoras\), agora\);/);
  assert.equal((relogio.match(/PRAZO_RESPOSTA_PADRAO_HORAS/g) ?? []).length, 0, "o padrão entra só por horasDeResposta");
});
