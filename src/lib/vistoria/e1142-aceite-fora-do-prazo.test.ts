import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PRAZO_DONO_ACEITAR_HORAS } from "./prazos.ts";
import { ERRO_ACEITE_FORA_DO_PRAZO, aceiteForaDoPrazo, relogioDoPedido, textoDoPrazoDeAceite } from "./relogio-do-pedido.ts";

/*
  E1142 (ORDEM-DUET-619, linha Parceiros, classe B): o dono conseguia aceitar a proposta do avaliador depois de o prazo
  de 72 horas vencer. A ação `aceitarProposta` não conferia o prazo, e a expiração só corre na rotina diária (12:00 de
  Brasília): entre o fim do prazo e a rotina, o botão "Aceitar valor e prazo" gravava o aceite de uma proposta vencida.
  A regra é a do relógio do pedido (E1101), a mesma das telas e da rotina.
  ORDEM-DUET-620 (a outra face do defeito): com o prazo vencido, a tela do avaliador continuava a dizer "O proprietário
  tem até 25/11/2026 23:21 para aceitar…". Passa a dizer que o prazo terminou, na lista e na tela do pedido.
*/
const HORA = 3_600_000;
const PROPOSTA = "2026-11-20T15:00:00.000Z";
const depois = (ms: number) => new Date(Date.parse(PROPOSTA) + ms);
const pedido = { propostaEm: PROPOSTA, teste: false, escolhidoEm: "2026-11-20T10:00:00.000Z" };
const ler = (p: string) => readFileSync(p, "utf8");
const semComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

test("E1142: dentro das 72 h o dono aceita; no instante em que o prazo acaba, já não", () => {
  assert.equal(PRAZO_DONO_ACEITAR_HORAS, 72);
  assert.equal(aceiteForaDoPrazo(pedido, depois(0)), false);
  assert.equal(aceiteForaDoPrazo(pedido, depois(72 * HORA - 1)), false, "um milissegundo antes do fim ainda aceita");
  assert.equal(aceiteForaDoPrazo(pedido, depois(72 * HORA)), true, "no fim do prazo já é fora do prazo (a mesma borda da rotina)");
  assert.equal(aceiteForaDoPrazo(pedido, depois(73 * HORA)), true);
  assert.equal(aceiteForaDoPrazo(pedido, depois(30 * 24 * HORA)), true);
});

test("E1142: a conta é a do relógio do pedido — o que a tela mostra vencido é o que o aceite recusa", () => {
  for (const ms of [0, 71 * HORA, 72 * HORA - 1, 72 * HORA, 72 * HORA + 1, 100 * HORA]) {
    const agora = depois(ms);
    const r = relogioDoPedido({ status: "designado", resposta: "aceita", designadoEm: pedido.escolhidoEm, propostaEm: PROPOSTA, propostaAceitaEm: null, precisaDoAceite: true }, agora);
    assert.equal(aceiteForaDoPrazo(pedido, agora), r!.vez === "dono" && r!.vencido, `${ms} ms depois da proposta`);
  }
});

test("E1142: no piloto (pedido de teste que o dono escolheu) o prazo vale; a avaliação de teste do credenciamento não tem aceite nem prazo dele", () => {
  const vencido = depois(80 * HORA);
  assert.equal(aceiteForaDoPrazo({ ...pedido, teste: true }, vencido), true, "piloto: o dono escolheu, o prazo é dele");
  assert.equal(aceiteForaDoPrazo({ propostaEm: PROPOSTA, teste: true, escolhidoEm: null }, vencido), false, "credenciamento: sem aceite do dono");
  assert.equal(aceiteForaDoPrazo({ ...pedido, propostaEm: null }, vencido), false, "sem proposta não há prazo de aceite");
  assert.equal(aceiteForaDoPrazo({ ...pedido, propostaEm: "data ruim" }, vencido), false);
});

test("E1142: o aviso diz o prazo (lido da fonte única) e o que fazer a seguir", () => {
  assert.equal(ERRO_ACEITE_FORA_DO_PRAZO, "O prazo de 72 horas para aceitar esta proposta terminou. Escolha outro avaliador.");
  assert.match(semComentarios(ler("src/lib/vistoria/relogio-do-pedido.ts")), /ERRO_ACEITE_FORA_DO_PRAZO = `O prazo de \$\{PRAZO_DONO_ACEITAR_HORAS\} horas /);
});

test("E1142: `aceitarProposta` confere o prazo ANTES de gravar o aceite e devolve o aviso; nada é gravado nem avisado", () => {
  const acoes = semComentarios(ler("src/lib/vistoria/actions.ts"));
  const dono = acoes.slice(acoes.indexOf("async function comoDonoDoPedido("), acoes.indexOf("export async function aceitarProposta("));
  // O pedido lido traz o que a regra precisa (teste e quem escolheu).
  assert.match(dono, /\.select\("[^"]*\bproposta_em\b[^"]*\bescolhido_em\b[^"]*\bteste\b[^"]*"\)|\.select\("[^"]*\bteste\b[^"]*\bescolhido_em\b[^"]*"\)/);
  const aceitar = acoes.slice(acoes.indexOf("export async function aceitarProposta("), acoes.indexOf("export async function recusarProposta("));
  assert.ok(aceitar.length > 100);
  const confere = aceitar.indexOf("if (aceiteForaDoPrazo(");
  const recusa = aceitar.indexOf("return { ok: false, erro: ERRO_ACEITE_FORA_DO_PRAZO };");
  const grava = aceitar.indexOf(".update({ proposta_aceita_em:");
  const avisa = aceitar.indexOf("await avisar(");
  assert.ok(confere > 0, "a ação não confere o prazo");
  assert.ok(recusa > confere, "vencida: devolve o aviso");
  assert.ok(grava > recusa && avisa > recusa, "a recusa vem antes de gravar o aceite e de avisar o avaliador");
  // O botão da tela é o formulário da ação: o aviso sai junto dele (o <p role="alert"> do FormAcao).
  const bloco = ler("src/components/vistoria/bloco-avaliacao-dono.tsx");
  assert.match(bloco, /<FormAcao acao=\{aceitarProposta\} testid="aceitar-proposta">/);
  assert.match(ler("src/components/vistoria/form-acao.tsx"), /role=\{mostrar\.ok \? "status" : "alert"\}[^>]*data-testid=\{mostrar\.ok \? "acao-ok" : "acao-erro"\}/);
});

test("E1142 (ORDEM-620): vencido, o avaliador lê que o prazo do dono terminou — não mais 'tem até' uma data passada", () => {
  // Proposta de 20/11 15:00Z: as 72 h acabam em 23/11 15:00Z = 23/11 12:00 em Brasília.
  const noPrazo = relogioDoPedido({ status: "designado", resposta: "aceita", designadoEm: pedido.escolhidoEm, propostaEm: PROPOSTA, propostaAceitaEm: null, precisaDoAceite: true }, depois(10 * HORA))!;
  const vencido = relogioDoPedido({ status: "designado", resposta: "aceita", designadoEm: pedido.escolhidoEm, propostaEm: PROPOSTA, propostaAceitaEm: null, precisaDoAceite: true }, depois(73 * HORA))!;
  assert.equal(textoDoPrazoDeAceite(noPrazo), "O proprietário tem até 23/11/2026 12:00 (horário de Brasília) para aceitar: 72 horas depois da proposta. Sem o aceite, o pedido volta para ele escolher de novo.");
  assert.equal(vencido.vencido, true);
  assert.equal(textoDoPrazoDeAceite(vencido), "O prazo do proprietário para aceitar a sua proposta terminou em 23/11/2026 12:00 (horário de Brasília). Ela não pode mais ser aceita, e o pedido volta para ele escolher de novo.");
  assert.doesNotMatch(textoDoPrazoDeAceite(vencido), /tem até/);
});

test("E1142 (ORDEM-620): a lista e a tela do pedido do avaliador mostram esse texto e deixam de dizer 'falta o proprietário aceitar'", () => {
  const lista = ler("src/app/(dashboard)/dashboard/parceiro/avaliacao/page.tsx");
  assert.match(lista, /const aceiteVencido = relogio\?\.vez === "dono" && relogio\.vencido;/);
  assert.match(lista, /\{aceiteVencido \? "" : " Falta o proprietário aceitar para agendar a visita\."\}/);
  assert.match(lista, /data-testid="prazo-aceite" data-vencido=\{aceiteVencido \? "1" : undefined\}>\s*\{textoDoPrazoDeAceite\(relogio\)\}/);
  const pagina = ler("src/app/(dashboard)/dashboard/parceiro/avaliacao/[pedido]/page.tsx");
  assert.match(pagina, /prazoAceite=\{etapa === "proposta_enviada" && relogio\?\.vez === "dono" \? textoDoPrazoDeAceite\(relogio\) : null\}/);
  assert.match(pagina, /prazoAceiteVencido=\{etapa === "proposta_enviada" && relogio\?\.vez === "dono" && relogio\.vencido\}/);
  const tela = ler("src/components/avaliadores/pedido.tsx");
  assert.match(tela, /\{!prazoAceiteVencido && "Falta o proprietário aceitar a sua proposta\./);
  assert.match(tela, /data-testid="pedido-prazo-aceite" data-vencido=\{prazoAceiteVencido \? "1" : undefined\}/);
});
