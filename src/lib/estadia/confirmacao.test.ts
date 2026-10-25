/*
  Prompt 61-A — "Estadia confirmada", horários e local na página da estadia, "Como funcionam as avaliações".
  Roda: node --test src/lib/estadia/confirmacao.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { HREF_CONFIRMADA, TEXTO_CONFIRMADA, TITULO_CONFIRMADA, proximosPassos } from "./confirmacao.ts";
import { montarLinhaDoTempo } from "../estadia-linha-tempo.ts";
import { MINUTOS_ADITIVO_RECEM_ASSINADO, aditivoEmTela } from "./aditivo-em-tela.ts";
import { REGRAS_AVALIACOES, TITULO_COMO_FUNCIONAM, linhaAutorAvaliacao } from "../avaliacoes-exibicao.ts";
import { TEXTO_PROIBIDO } from "../estilo/estilo-padrao.test.ts";

const SRC = new URL("../../", import.meta.url).pathname;
const ler = (p: string) => readFileSync(SRC + p, "utf8");
const PERIODO = { inicio: "2026-11-13", fim: "2027-02-10", checkinAfter: "14:00", checkoutBefore: "11:00" };

test("confirmação: textos exatos, sem exclamação nem festa", () => {
  assert.equal(TITULO_CONFIRMADA, "Estadia confirmada");
  assert.equal(TEXTO_CONFIRMADA, "Contrato assinado pelos dois lados.");
  assert.equal(HREF_CONFIRMADA("c1"), "/dashboard/estadia/c1/confirmada");
  const pagina = ler("app/(dashboard)/dashboard/estadia/[contratoId]/confirmada/page.tsx");
  assert.doesNotMatch(pagina.replace(/\/\*[\s\S]*?\*\//g, ""), /!["<\s]|confete|parab[ée]ns|🎉/i);
  for (const t of [TITULO_CONFIRMADA, TEXTO_CONFIRMADA]) assert.doesNotMatch(t, TEXTO_PROIBIDO);
});

test("confirmação: o próximo passo é a Caução e a conferência de entrada, cada uma com o prazo", () => {
  assert.deepEqual(proximosPassos(PERIODO, "pendente"), [
    { chave: "caucao", rotulo: "Caução", prazo: "até a entrada, em 13/11/2026" },
    { chave: "conferencia", rotulo: "Conferência de entrada", prazo: "até 15/11 às 14:00, horário de Brasília" },
  ]);
  assert.deepEqual(proximosPassos(PERIODO, "recebida").map((p) => p.chave), ["conferencia"], "Caução já recebida não é passo");
  assert.deepEqual(proximosPassos(PERIODO, "dispensada").map((p) => p.chave), ["conferencia"], "seguro-fiança: sem Caução");
  const sem = proximosPassos({ inicio: null, fim: null }, "pendente");
  assert.equal(sem[0].prazo, "até a entrada, data a definir");
  assert.equal(sem[1].prazo, "a definir, com a data de entrada");
});

test("confirmação: só depois das duas assinaturas e uma vez (a segunda assinatura leva à tela; o aviso de quem assinou antes também)", () => {
  const pagina = ler("app/(dashboard)/dashboard/estadia/[contratoId]/confirmada/page.tsx");
  assert.match(pagina, /if \(!e\.assinadoPorAmbos\) redirect\(HREF_ESTADIA\(e\.id\)\)/);
  assert.equal((pagina.match(/variant="primary"/g) ?? []).length, 1, "um primário só");
  assert.match(pagina, /Ver a página da estadia/);
  const form = ler("components/contrato/assinar-contrato.tsx");
  assert.match(form, /if \(r\.ambos\) \{\s*router\.push\(HREF_CONFIRMADA\(contratoId\)\);/);
  const acao = ler("lib/data/contrato-assinar-actions.ts");
  assert.match(acao, /return \{ ok: true, aviso, ambos: outraJaAssinou \};/);
  assert.match(acao, /pushUrl: outraJaAssinou \? HREF_CONFIRMADA\(c\.id\)/);
  assert.match(acao, /pushUrl: HREF_CONFIRMADA\(c\.id\),/);
  // Acessível pela página da estadia depois das duas assinaturas.
  const estadia = ler("app/(dashboard)/dashboard/estadia/[contratoId]/page.tsx");
  assert.match(estadia, /\{e\.assinadoPorAmbos && \(\s*<Link href=\{HREF_CONFIRMADA\(e\.id\)\}/);
});

test("página da estadia: horários de checkin_after / checkout_before na linha do tempo, da mesma fonte", () => {
  const [entrada, , saida] = montarLinhaDoTempo(PERIODO);
  assert.equal(entrada.titulo, "Entrada");
  assert.equal(entrada.horario, "a partir das 14:00, horário de Brasília");
  assert.equal(saida.titulo, "Saída");
  assert.equal(saida.horario, "até as 11:00, horário de Brasília");
  const estadia = ler("app/(dashboard)/dashboard/estadia/[contratoId]/page.tsx");
  assert.match(estadia, /checkinAfter: e\.periodo\.checkinAfter \?\? null,\s*checkoutBefore: e\.periodo\.checkoutBefore \?\? null/);
  // e.periodo vem de properties.checkin_after/checkout_before (periodoDaEstadia), a mesma coluna do prazo da conferência.
  assert.match(ler("lib/estadia/estadia.ts"), /checkinAfter: imovel\?\.checkin_after \?\? null, checkoutBefore: imovel\?\.checkout_before \?\? null/);
  assert.match(estadia, /<LinhaDoTempoEstadia etapas=\{etapas\} semMensagens \/>/);
});

test("página da estadia: endereço exato só com o contrato assinado pelas duas partes; antes, região aproximada", () => {
  const estadia = ler("app/(dashboard)/dashboard/estadia/[contratoId]/page.tsx");
  assert.match(estadia, /localDaEstadia\(e\.imovel\.id, e\.assinadoPorAmbos\)/);
  assert.match(ler("lib/data/estadia-local.ts"), /endereco: contratada \? enderecoDaVisita\(\{ \.\.\.p, exact_address: exato \}\) : null/);
  assert.match(ler("lib/data/estadia-local.ts"), /const exato = contratada\s*\?/, "o endereço exato só é lido com as duas assinaturas");
  const bloco = ler("components/estadia/local-estadia.tsx");
  assert.match(bloco, /approximate=\{!exato\}/);
  assert.match(bloco, /proximidades/);
  assert.match(ler("lib/data/estadia-local.ts"), /proximidadesDoImovel\(/, "a mesma lista do bloco do Prompt 37");
});

test("aditivo recém-assinado fica no painel por alguns minutos (a confirmação não some com o refresh)", () => {
  const agora = new Date("2026-10-23T15:00:00Z");
  const assinado = (min: number) => ({ id: `a${min}`, status: "assinado", assinadoEm: new Date(agora.getTime() - min * 60_000).toISOString() });
  assert.equal(aditivoEmTela([assinado(2), { id: "p", status: "aceito", assinadoEm: null }], agora)?.id, "p", "o aberto vem primeiro");
  assert.equal(aditivoEmTela([assinado(2)], agora)?.id, "a2");
  assert.equal(aditivoEmTela([assinado(MINUTOS_ADITIVO_RECEM_ASSINADO + 1)], agora), undefined, "depois disso, só no histórico");
  assert.equal(aditivoEmTela([{ id: "r", status: "recusado", assinadoEm: null }], agora), undefined);
  assert.match(ler("app/(dashboard)/dashboard/estadia/[contratoId]/page.tsx"), /const aberto = aditivoEmTela\(e\.aditivos\);/);
});

test("avaliações: 'Como funcionam as avaliações' com as regras do servidor; quem avaliou com cidade e ano", () => {
  assert.equal(TITULO_COMO_FUNCIONAM, "Como funcionam as avaliações");
  assert.equal(REGRAS_AVALIACOES[0], "Só avalia quem morou no imóvel, com contrato assinado pela Viva.");
  assert.equal(REGRAS_AVALIACOES[2], "A avaliação é publicada depois que os dois avaliam, ou 14 dias depois do fim da estadia.");
  assert.equal(linhaAutorAvaliacao({ cidade: "Uberlândia", desde: "2025-03-14T10:00:00Z" }), "Uberlândia · na Viva desde 2025");
  assert.equal(linhaAutorAvaliacao({ cidade: "", desde: "2024-01-02T00:00:00Z" }), "na Viva desde 2024");
  assert.equal(linhaAutorAvaliacao({ cidade: null, desde: null }), null);
  const reviews = ler("components/property/reviews.tsx");
  assert.equal((reviews.match(/<ComoFuncionamAvaliacoes \/>/g) ?? []).length, 2, "com e sem avaliações");
  assert.match(reviews, /data-testid="avaliacao-autor"/);
  assert.match(ler("components/property/avaliacoes-exemplo.tsx"), /<ComoFuncionamAvaliacoes \/>/);
  const folha = ler("components/avaliacoes/como-funcionam-avaliacoes.tsx");
  assert.match(folha, /gatilho\.current\?\.focus\(\)/, "Esc fecha e o foco volta ao link");
  for (const r of REGRAS_AVALIACOES) assert.doesNotMatch(r, TEXTO_PROIBIDO);
});
