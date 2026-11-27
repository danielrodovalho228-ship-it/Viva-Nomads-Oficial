import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { FAIXA_VISITA_DE_TESTE, RECUSA_ANTES_DO_DIA, liberadaSoPorTeste, recusaDaVisita, visitaEmAndamento, visitaLiberada } from "./visita-avaliador.ts";
import { fonteSemComentarios as semComentarios } from "../fonte-sem-comentarios.ts";

/*
  E1178 (ORDENS-DUET 777 e 779; decisão do coordenador; linha Parceiros). Duas coisas no mesmo item:
   • a exceção de teste: o pedido de TESTE com o avaliador de TESTE faz a visita antes do dia marcado (é o que deixa a
     passagem ao vivo seguir sem esperar o dia); pedido real ou avaliador real nunca;
   • o furo de segurança: a regra "a visita começa no dia marcado" só existia na etiqueta da tela. O servidor aceitava
     itens, fotos, medições, ruído e a conclusão da visita em qualquer dia. Agora a regra mora numa função só
     (visitaLiberada) e as cinco ações da visita recusam antes do dia.
  Roda: node --test src/lib/vistoria/e1178-visita-de-teste-antes-do-dia.test.ts
*/
const ler = (p: string) => semComentarios(readFileSync(p, "utf8"));
// 12:00 de 24/11/2026 em Brasília.
const AGORA = new Date("2026-11-24T15:00:00Z");
const AMANHA = "2026-11-25T13:00:00Z"; // 25/11 às 10:00 de Brasília
const HOJE = "2026-11-24T20:00:00Z"; // 24/11 às 17:00 de Brasília
const v = (pedidoTeste: boolean, avaliadorTeste: boolean, agendadoPara: string | null = AMANHA, status = "agendado") => ({ status, agendadoPara, pedidoTeste, avaliadorTeste });

test("E1178 — a tabela da ordem: só o pedido de teste COM o avaliador de teste faz a visita antes do dia", () => {
  assert.equal(visitaLiberada(v(true, true), AGORA), true, "teste | teste | antes do dia → liberada");
  assert.equal(visitaLiberada(v(true, false), AGORA), false, "teste | real | antes do dia → não");
  assert.equal(visitaLiberada(v(false, true), AGORA), false, "real | teste | antes do dia → não");
  assert.equal(visitaLiberada(v(false, false), AGORA), false, "real | real | antes do dia → não");
  assert.equal(visitaLiberada(v(false, false, HOJE), AGORA), true, "real | real | no dia → liberada");
  for (const status of ["pedido", "designado", "realizada", "laudo_emitido", "cancelado", ""]) {
    for (const [pt, at] of [[true, true], [true, false], [false, true], [false, false]] as const) {
      assert.equal(visitaLiberada(v(pt, at, HOJE, status), AGORA), false, `status ${status || "(vazio)"} → não`);
      assert.equal(visitaLiberada(v(pt, at, AMANHA, status), AGORA), false, `status ${status || "(vazio)"}, antes do dia → não`);
    }
  }
});

test("E1178: o dia é o de Brasília, como já era — e o dia que passou continua liberado", () => {
  // 25/11 01:00 UTC são 22:00 de 24/11 em Brasília: lá ainda é hoje.
  assert.equal(visitaLiberada(v(false, false, "2026-11-25T01:00:00Z"), AGORA), true);
  // 25/11 04:00 UTC já é 25/11 em Brasília.
  assert.equal(visitaLiberada(v(false, false, "2026-11-25T04:00:00Z"), AGORA), false);
  assert.equal(visitaLiberada(v(false, false, "2026-11-20T13:00:00Z"), AGORA), true, "dia já passado e ainda por concluir");
  assert.equal(visitaLiberada(v(false, false, null), AGORA), false, "sem data marcada não há dia que tenha chegado");
  // Só o `true` exato libera pela exceção: um valor que não veio da base não libera ninguém.
  assert.equal(visitaLiberada({ status: "agendado", agendadoPara: AMANHA, pedidoTeste: undefined as unknown as boolean, avaliadorTeste: true }, AGORA), false);
  assert.equal(visitaLiberada({ status: "agendado", agendadoPara: AMANHA, pedidoTeste: true, avaliadorTeste: null as unknown as boolean }, AGORA), false);
});

test("E1178: visitaEmAndamento passa a usar a função única — e continua a dizer só o dia", () => {
  assert.equal(visitaEmAndamento("agendado", HOJE, AGORA), true);
  assert.equal(visitaEmAndamento("agendado", AMANHA, AGORA), false, "a etiqueta 'em andamento' não se adianta com a exceção de teste");
  assert.equal(visitaEmAndamento("realizada", HOJE, AGORA), false);
  const fonte = ler("src/lib/vistoria/visita-avaliador.ts");
  const corpo = fonte.slice(fonte.indexOf("export function visitaEmAndamento"));
  assert.match(corpo.slice(0, corpo.indexOf("\n}") + 2), /return visitaLiberada\(/);
  // A conta do dia existe num lugar só.
  assert.equal(fonte.match(/diaBRT\(agora\)/g)?.length, 1);
});

test("E1178: a faixa de teste só aparece quando a liberação veio SÓ da exceção", () => {
  assert.equal(FAIXA_VISITA_DE_TESTE, "Visita de teste — liberada antes do dia marcado.");
  assert.equal(liberadaSoPorTeste(v(true, true), AGORA), true);
  assert.equal(liberadaSoPorTeste(v(true, true, HOJE), AGORA), false, "no dia, a visita de teste é uma visita como as outras");
  assert.equal(liberadaSoPorTeste(v(false, false, HOJE), AGORA), false);
  assert.equal(liberadaSoPorTeste(v(true, false), AGORA), false);
  assert.equal(liberadaSoPorTeste(v(true, true, AMANHA, "realizada"), AGORA), false);
});

test("E1178 (servidor): antes do dia a visita real é recusada com o texto; a de teste com avaliador de teste passa", () => {
  assert.equal(RECUSA_ANTES_DO_DIA, "A visita só começa no dia marcado.");
  assert.equal(recusaDaVisita(v(false, false), AGORA), RECUSA_ANTES_DO_DIA);
  assert.equal(recusaDaVisita(v(true, false), AGORA), RECUSA_ANTES_DO_DIA);
  assert.equal(recusaDaVisita(v(false, true), AGORA), RECUSA_ANTES_DO_DIA);
  assert.equal(recusaDaVisita(v(true, true), AGORA), null);
  assert.equal(recusaDaVisita(v(false, false, HOJE), AGORA), null);
});

test("E1178: a fila do aparelho não é afetada — o envio que chega depois é sempre de depois do início", () => {
  // O avaliador respondeu no dia da visita, sem rede; o aparelho envia três dias depois, com a visita ainda por concluir.
  const tresDiasDepois = new Date("2026-11-27T15:00:00Z");
  assert.equal(recusaDaVisita(v(false, false, HOJE), tresDiasDepois), null);
  // Ou envia depois de a visita ter sido concluída: o pedido já está "realizada" e os itens ainda entram (como antes).
  assert.equal(recusaDaVisita(v(false, false, HOJE, "realizada"), tresDiasDepois), null);
  assert.equal(recusaDaVisita(v(false, false, AMANHA, "realizada"), AGORA), null, "a visita concluída não volta a ser travada pela data");
});

test("E1178 (servidor): as cinco ações da visita chamam a regra; o envio do laudo continua a exigir a visita concluída", () => {
  const acoes = ler("src/lib/vistoria/laudo-actions.ts");
  const corpoDe = (nome: string) => {
    const i = acoes.indexOf(`export async function ${nome}(`);
    assert.ok(i >= 0, nome);
    const fim = acoes.indexOf("\nexport async function ", i + 1);
    return acoes.slice(i, fim < 0 ? undefined : fim);
  };
  for (const nome of ["salvarItens", "enviarFotoAvaliacao", "registrarMedicao", "salvarRuidoVisita", "concluirVisita"]) {
    const corpo = corpoDe(nome);
    assert.match(corpo, /const recusa = recusaDaVisita\(c\.visita, new Date\(\)\);\n\s+if \(recusa\) return \{ ok: false, erro: recusa \};/, nome);
    // A recusa vem antes de qualquer gravação.
    const naRecusa = corpo.indexOf("recusaDaVisita(");
    for (const grava of [".upsert(", ".insert(", ".update(", "gravarFoto("]) {
      const k = corpo.indexOf(grava);
      if (k >= 0) assert.ok(naRecusa < k, `${nome}: a recusa vem antes de ${grava}`);
    }
  }
  const laudo = corpoDe("enviarLaudo");
  assert.doesNotMatch(laudo, /recusaDaVisita/);
  assert.match(laudo, /c\.p\.status !== "realizada"/);
  // A sessão do avaliador traz o que a regra precisa: o pedido de teste e a conta de teste.
  const sessao = acoes.slice(acoes.indexOf("async function comoAvaliador("), acoes.indexOf("const EM_VISITA"));
  assert.match(sessao, /\.select\("id, property_id, owner_id, status, tipo, agendado_para, teste, avaliador_id,/);
  assert.match(sessao, /from\("profiles"\)\.select\("is_teste"\)\.eq\("id", s\.userId\)/);
  assert.match(sessao, /pedidoTeste: p\.teste === true, avaliadorTeste: conta\?\.is_teste === true/);
});

test("E1178 (tela): a página do avaliador usa a mesma regra, mostra a faixa de teste e não oferece a visita antes do dia", () => {
  const pagina = ler("src/app/(dashboard)/dashboard/parceiro/avaliacao/[pedido]/page.tsx");
  assert.match(pagina, /\.select\("id, property_id, status, tipo, teste, ocupado, agendado_para,/);
  assert.match(pagina, /from\("profiles"\)\.select\("is_teste"\)\.eq\("id", user\.id\)/);
  assert.match(pagina, /const liberada = visitaLiberada\(visita, agoraDaVisita\);/);
  assert.match(pagina, /liberadaSoPorTeste\(visita, agoraDaVisita\)/);
  assert.match(pagina, /data-testid="visita-de-teste">\{FAIXA_VISITA_DE_TESTE\}</);
  assert.match(pagina, /data-testid="visita-antes-do-dia">\{RECUSA_ANTES_DO_DIA\}/);
  // ORDEM-431 (t1725, caso 5): antes do dia o roteiro e as fotos continuam na tela — só em leitura. O que leva ao
  // envio (as vagas "Adicionar foto" e o "Continuar") sai, porque o servidor recusaria.
  assert.match(pagina, /\{agendada && <VisitaEmAndamento capaUrl=\{capaUrl\} roteiro=\{roteiro\} fotos=\{miniaturas\} soLeitura=\{antesDoDia\} \/>\}/);
  assert.match(pagina, /\{emVisita && !antesDoDia && \(/);
  const bloco = ler("src/components/avaliadores/visita.tsx");
  assert.match(bloco, /\{!soLeitura &&\s+Array\.from\(\{ length: vagas \}/);
  assert.match(bloco, /\{!soLeitura && \(\s+<a href="#itens"/);
  // Os textos moram na fonte da regra, não na página.
  assert.doesNotMatch(pagina, /Visita de teste —|A visita só começa no dia marcado/);
});
