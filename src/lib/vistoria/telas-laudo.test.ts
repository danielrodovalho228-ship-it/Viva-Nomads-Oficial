/*
  Prompt 62-A, Parte 2 (execução, laudo, resultado do dono, ficha e cartão, strikes, admin) — textos exatos, a delimitação
  do laudo nas telas, nenhum "50%" (adendo 62-B1), nenhum texto proibido e um primário por tela.
  Roda: node --test src/lib/vistoria/telas-laudo.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  AVISO_SEM_PESSOAS,
  ROTULO_ACAO,
  TEXTO_TESTE_EM_USO,
  acoesDoResultado,
  avisoStrike,
  contagemContestacoes,
  linhaAvaliadoEm,
  linhaResumoGrupo,
  passosDoChecklist,
  pedeFotoDoItem,
  prazoDoLaudo,
  prefixoAvaliadoEm,
  rotuloPasso,
  textoFaltaFotos,
} from "./telas-laudo.ts";
import { hrefAvaliador } from "./telas-exibicao.ts";
import { itensSintese, textoNivelCartao } from "../cartao-sintese.ts";
import { GRUPOS_AVALIACAO, ITENS_CHECKLIST } from "../../config/checklist-avaliacao.ts";
import { TEXTO_PROIBIDO } from "../estilo/estilo-padrao.test.ts";

const raiz = new URL("../../../", import.meta.url).pathname;
const ler = (p: string) => readFileSync(raiz + p, "utf8");
const semComentarios = (f: string) => f.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
const primarios = (f: string) => (semComentarios(f).match(/<Button(?![^>]*variant=)[^>]*>/g) ?? []).length + (semComentarios(f).match(/variant="primary"/g) ?? []).length;

const CHECKLIST = ler("src/components/vistoria/checklist-avaliador.tsx");
const EXECUCAO = ler("src/app/(dashboard)/dashboard/parceiro/avaliacao/[pedido]/page.tsx");
const LAUDO_DONO = ler("src/components/vistoria/laudo-dono.tsx");
const FICHA = ler("src/components/niveis/avaliacao-ficha.tsx");
const AVISO_PAINEL = ler("src/components/vistoria/aviso-strike-painel.tsx");
const ADMIN = ler("src/app/(dashboard)/admin/avaliadores/page.tsx");
const TELAS = [CHECKLIST, EXECUCAO, LAUDO_DONO, FICHA, AVISO_PAINEL, ADMIN, ler("src/lib/vistoria/telas-laudo.ts")];

test("execução por passos: 9 grupos na ordem, contagem por grupo e rótulo 'Passo N de 9'", () => {
  const vazio = passosDoChecklist({});
  assert.equal(vazio.length, GRUPOS_AVALIACAO.length);
  assert.equal(vazio.length, 9);
  assert.deepEqual(vazio.map((p) => p.passo), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.ok(vazio.every((p) => p.respondidos === 0 && !p.completo));
  const primeiro = GRUPOS_AVALIACAO[0];
  const doPrimeiro = ITENS_CHECKLIST.filter((i) => i.grupo === primeiro.id);
  const cheio = passosDoChecklist(Object.fromEntries(doPrimeiro.map((i) => [i.chave, "conforme"])));
  assert.equal(cheio[0].completo, true);
  assert.equal(cheio[0].respondidos, doPrimeiro.length);
  assert.equal(rotuloPasso({ passo: 3, rotulo: "Banho" }), "Passo 3 de 9 · Banho");
});

test("textos exatos da execução: sem pessoas, teste em uso, fila de fotos", () => {
  assert.equal(AVISO_SEM_PESSOAS, "Sem pessoas e sem pertences nas fotos.");
  assert.equal(TEXTO_TESTE_EM_USO, "Teste em uso");
  assert.equal(textoFaltaFotos(0), null);
  assert.equal(textoFaltaFotos(1), "Falta enviar 1 foto");
  assert.equal(textoFaltaFotos(3), "Falta enviar 3 fotos");
  assert.equal(pedeFotoDoItem("nao_conforme"), true);
  assert.equal(pedeFotoDoItem("conforme"), false);
  assert.equal(pedeFotoDoItem(undefined), false);
  assert.match(CHECKLIST, /AVISO_SEM_PESSOAS/);
  assert.match(CHECKLIST, /TEXTO_TESTE_EM_USO/);
  assert.match(CHECKLIST, /textoFaltaFotos/);
});

test("laudo do avaliador: prazo de 48 horas úteis em Brasília e a delimitação na revisão", () => {
  // Visita na sexta 23/10/2026 às 10:00 de Brasília: 48 horas úteis caem na terça 27/10 às 10:00.
  const visita = "2026-10-23T13:00:00Z";
  const ok = prazoDoLaudo(visita, new Date("2026-10-24T12:00:00Z"));
  assert.equal(ok.vencido, false);
  assert.equal(ok.texto, "Envie até 27/10/2026 às 10:00, horário de Brasília (48 horas úteis da visita).");
  const vencido = prazoDoLaudo(visita, new Date("2026-10-28T12:00:00Z"));
  assert.equal(vencido.vencido, true);
  assert.match(vencido.texto, /^Prazo de 48 horas úteis vencido em 27\/10\/2026 às 10:00\./);
  assert.match(EXECUCAO, /DELIMITACAO_LAUDO/);
  assert.match(FICHA, /DELIMITACAO_LAUDO/);
});

test("resultado do dono: ações por resultado (correção, nova avaliação, contestar em 7 dias)", () => {
  const base = { emitidoEm: "2026-10-20T13:00:00Z", prazoRessalvaAte: "2026-11-04T13:00:00Z", corrigidoEm: null, ressalvaVencidaEm: null, contestadoEm: null };
  const agora = new Date("2026-10-23T13:00:00Z");
  assert.deepEqual(acoesDoResultado({ ...base, resultado: "aprovado", prazoRessalvaAte: null }, agora), []);
  assert.deepEqual(acoesDoResultado({ ...base, resultado: "com_ressalvas" }, agora), ["enviar_correcao", "contestar"]);
  assert.deepEqual(acoesDoResultado({ ...base, resultado: "reprovado", prazoRessalvaAte: null }, agora), ["nova_avaliacao", "contestar"]);
  // Depois dos 7 dias, não contesta; ressalva vencida vira nova avaliação.
  const depois = new Date("2026-11-10T13:00:00Z");
  assert.deepEqual(acoesDoResultado({ ...base, resultado: "com_ressalvas", ressalvaVencidaEm: "2026-11-05T03:00:00Z" }, depois), ["nova_avaliacao"]);
  assert.deepEqual(ROTULO_ACAO, { enviar_correcao: "Enviar correção", nova_avaliacao: "Pedir nova avaliação", contestar: "Contestar" });
});

test("ficha e cartão: 'Avaliado em … por avaliador credenciado nº X', resumo por grupo e '· vistoriado'", () => {
  assert.equal(linhaAvaliadoEm("2026-10-25T13:00:00Z", "UDI-007"), "Avaliado em 25/10/2026 por avaliador credenciado nº UDI-007");
  assert.equal(linhaResumoGrupo({ conformes: 8, naoConformes: [] }), "8 conformes");
  assert.equal(linhaResumoGrupo({ conformes: 6, naoConformes: ["a"] }), "6 conformes · 1 não conforme");
  assert.equal(linhaResumoGrupo({ conformes: 5, naoConformes: ["a", "b"] }), "5 conformes · 2 não conformes");
  assert.equal(textoNivelCartao("Conforto", true), "Conforto · vistoriado");
  assert.equal(textoNivelCartao("Conforto", false), "Conforto");
  assert.equal(itensSintese({ nivel: "premium", nivelVistoriado: true, bedrooms: 2 })[0].texto, "Premium · vistoriado");
  assert.equal(itensSintese({ nivel: "premium", bedrooms: 2 })[0].texto, "Premium");
  assert.match(FICHA, /Ver laudo/);
});

test("strikes: um aviso por passo da escada; o 3º abre o painel com os anúncios fora da busca", () => {
  assert.equal(avisoStrike(0), null);
  assert.equal(avisoStrike(1)?.titulo, "Registro de verificação");
  assert.equal(avisoStrike(2)?.titulo, "Aviso formal");
  assert.equal(avisoStrike(3)?.titulo, "Seus anúncios estão fora da busca");
  for (const d of [1, 2, 3] as const) assert.ok(avisoStrike(d)!.texto.length > 10);
  assert.match(AVISO_PAINEL, /"strike_3"/);
  assert.match(ler("src/app/(dashboard)/dashboard/page.tsx"), /<AvisoStrikePainel \/>/);
});

test("admin: contestações, devoluções, laudos atrasados e auditoria no topo 'Para decidir', cada um com sua âncora", () => {
  const n = contagemContestacoes({ contestacoes: 2, devolucoes: 1, laudosAtrasados: 0, auditoria: 3 });
  assert.deepEqual(n.map((x) => [x.chave, x.valor, x.ancora]), [
    ["contestacoes", 2, "#contestacoes"],
    ["devolucoes", 1, "#contestacoes"],
    ["laudos-atrasados", 0, "#contestacoes"],
    ["auditoria", 3, "#auditoria"],
  ]);
  assert.match(ADMIN, /id="contestacoes"/);
  assert.match(ADMIN, /id="auditoria"/);
  // O t305 depende destes rótulos.
  assert.match(ADMIN, /Imóvel \(id\)/);
  assert.match(ADMIN, /Descrição do motivo/);
});

test("adendo 62-B1: nenhum '50%' nas telas; nenhum texto proibido; um primário por tela", () => {
  for (const f of TELAS) assert.doesNotMatch(semComentarios(f), /50\s*%/);
  const textos = [AVISO_SEM_PESSOAS, TEXTO_TESTE_EM_USO, ...Object.values(ROTULO_ACAO), ...[1, 2, 3].flatMap((d) => Object.values(avisoStrike(d as 1 | 2 | 3)!)), ...contagemContestacoes({ contestacoes: 0, devolucoes: 0, laudosAtrasados: 0, auditoria: 0 }).map((x) => x.rotulo)];
  for (const t of textos) assert.doesNotMatch(t, TEXTO_PROIBIDO);
  assert.equal(primarios(CHECKLIST), 0, "no checklist, as respostas são segmentos, não botões primários");
  // A execução tem 3 estados que não aparecem juntos: antes da visita concluída ("Concluir a visita"), depois dela ("Enviar o
  // laudo") e a reverificação de ressalva ("Confirmar a reverificação"). Cada estado mostra um primário só.
  assert.equal(primarios(EXECUCAO), 3);
  assert.match(EXECUCAO, /\{p\.status === "agendado" \? \(/, "Concluir e Enviar ficam em ramos opostos do mesmo ternário");
  assert.equal(primarios(LAUDO_DONO), 0, "o primário do bloco do dono continua sendo o pedido de avaliação");
  assert.equal(primarios(FICHA) + primarios(AVISO_PAINEL), 0);
});

test("E235: o nº do avaliador é link para /avaliadores/[numero] nos dois pontos do painel do dono, com o mesmo texto", () => {
  assert.equal(hrefAvaliador("UDI-007"), "/avaliadores/UDI-007");
  assert.equal(prefixoAvaliadoEm("2026-10-25T13:00:00Z") + "UDI-007", linhaAvaliadoEm("2026-10-25T13:00:00Z", "UDI-007"));
  const laudo = semComentarios(ler("src/components/vistoria/laudo-dono.tsx"));
  assert.match(laudo, /\{prefixoAvaliadoEm\(l\.vistoriado_em\)\}\s*<Link href=\{hrefAvaliador\(String\(cred\.numero_credenciado\)\)\}[^>]*>\{String\(cred\.numero_credenciado\)\}<\/Link>/);
  const bloco = semComentarios(ler("src/components/vistoria/bloco-avaliacao-dono.tsx"));
  assert.match(bloco, /Avaliador designado pela Viva: nº\{" "\}\s*<Link href=\{hrefAvaliador\(atual\.avaliadores_credenciamento\.numero_credenciado\)\}[^>]*>\s*\{atual\.avaliadores_credenciamento\.numero_credenciado\}\s*<\/Link>/);
  // A página pública existe e aceita o formato do número.
  assert.match(ler("src/app/(public)/avaliadores/[numero]/page.tsx"), /\^\[A-Z\]\{3\}-\\d\{3,\}\$/);
});
