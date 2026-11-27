import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PRAZO_LAUDO_MAX_DIAS_UTEIS, PRAZO_LAUDO_PADRAO_DIAS_UTEIS, diasUteisDoLaudo } from "./prazos.ts";
import { laudoAtrasado, laudoForaDoCombinado, prazoLaudo } from "./laudo.ts";
import { faixaDeReferencia, validarProposta, validarTermos } from "./escolha.ts";
import { INCLUI_SEMPRE } from "./regras.ts";
import { situacaoDono } from "./telas-exibicao.ts";
import { ROTULO_NUMERO_LAUDOS_FORA_DO_PRAZO, TITULO_LAUDOS_FORA_DO_PRAZO, contagemContestacoes, prazoDoLaudo } from "./telas-laudo.ts";
import { ROTULO_FILA } from "./rotulos-da-fila.ts";
import { diasUteis, linhaDoPrazoDoLaudo, linhaDoValor, prazoCombinadoNaLinhaDoDono, resumoDoValorNaLista, textoDaPropostaEnviada } from "./pedido-avaliador.ts";
import { textoDaTroca } from "./troca-de-avaliador.ts";
import { fonteSemComentarios as semComentarios } from "../fonte-sem-comentarios.ts";

/*
  E1156 (ORDENS-DUET 654, 712 e 713; linha Parceiros). O avaliador propunha "laudo em N dias" e o dono aceitava; mas o
  atraso media-se por outra regra, "48 horas úteis depois da visita", escrita em vários lugares. Decisão do Daniel
  (ORDEM-712): vale o PRAZO COMBINADO. Guardas do coordenador (ORDEM-713):
   • o prazo é em dias úteis depois da visita; o teto é 5; sem proposta do avaliador, o padrão é 2;
   • o dono vê o compromisso antes de aceitar, ao lado do valor; com a visita marcada, "Laudo até DD/MM/AAAA";
   • a frase das "48 horas úteis" sai de todo o lado e vira "O laudo no prazo combinado com o avaliador";
   • os pedidos já abertos mantêm a promessa que receberam: sem o prazo novo, o laudo conta pelos 2 dias úteis do
     padrão (as mesmas 48 horas úteis de antes) e os textos do "laudo em N dias" ficam como estavam.
  Roda: node --test src/lib/vistoria/e1156-prazo-combinado-do-laudo.test.ts
*/
const ler = (p: string) => semComentarios(readFileSync(p, "utf8"));
// Segunda 19/10/2026 às 10:00 de Brasília.
const VISITA = "2026-10-19T13:00:00Z";
const f = faixaDeReferencia(350);

test("E1156 — a trava nomeada: pedido sem prazo proposto usa o padrão; prazo acima do teto é recusado", () => {
  assert.equal(PRAZO_LAUDO_PADRAO_DIAS_UTEIS, 2);
  assert.equal(PRAZO_LAUDO_MAX_DIAS_UTEIS, 5);
  // Sem prazo proposto (pedido anterior à regra, ou avaliação de teste sem proposta): o padrão.
  for (const sem of [null, undefined, 0, -1, 2.5, Number.NaN]) assert.equal(diasUteisDoLaudo(sem), PRAZO_LAUDO_PADRAO_DIAS_UTEIS, `sem prazo válido (${sem})`);
  for (const n of [1, 2, 3, 4, 5]) assert.equal(diasUteisDoLaudo(n), n);
  // Acima do teto nunca vale mais do que o teto (a proposta já o recusou antes de gravar).
  assert.equal(diasUteisDoLaudo(9), PRAZO_LAUDO_MAX_DIAS_UTEIS);
  // A proposta: de 1 a 5 dias úteis passa; 6 é recusado, com o teto dito.
  assert.equal(validarProposta({ valor: 300, prazoDias: PRAZO_LAUDO_MAX_DIAS_UTEIS }, f).ok, true);
  const acima = validarProposta({ valor: 300, prazoDias: PRAZO_LAUDO_MAX_DIAS_UTEIS + 1 }, f);
  assert.deepEqual(acima, { ok: false, erro: "Informe o prazo do laudo em dias úteis inteiros, de 1 a 5, contados depois da visita." });
  assert.equal(validarProposta({ valor: 300, prazoDias: 0 }, f).ok, false);
  assert.equal(validarProposta({ valor: 300, prazoDias: 30 }, f).ok, false);
});

test("E1156: o prazo do laudo conta em dias úteis depois da visita — o combinado, ou o padrão", () => {
  // Sem prazo combinado: 2 dias úteis = as 48 horas úteis de antes (segunda 10h → quarta 10h).
  assert.equal(prazoLaudo(VISITA).toISOString(), "2026-10-21T13:00:00.000Z");
  assert.equal(prazoLaudo(VISITA, null).toISOString(), "2026-10-21T13:00:00.000Z");
  // Combinado 1 dia útil: terça 10h. Combinado 5 dias úteis: a segunda seguinte, 10h (pula o fim de semana).
  assert.equal(prazoLaudo(VISITA, 1).toISOString(), "2026-10-20T13:00:00.000Z");
  assert.equal(prazoLaudo(VISITA, 5).toISOString(), "2026-10-26T13:00:00.000Z");
  // O atraso mede-se pelo combinado: na quinta, o pedido de 2 dias já atrasou e o de 5 ainda não.
  const quinta = new Date("2026-10-22T13:00:00Z");
  assert.equal(laudoAtrasado(VISITA, null, quinta), true);
  assert.equal(laudoAtrasado(VISITA, null, quinta, 5), false);
  assert.equal(laudoAtrasado(VISITA, null, new Date("2026-10-26T13:00:01Z"), 5), true);
  assert.equal(laudoAtrasado(VISITA, "2026-10-20T10:00:00Z", new Date("2026-11-01T00:00:00Z"), 5), false);
});

test("E1156: a rotina mede o atraso pelo prazo do pedido e diz o prazo no item da fila", () => {
  const rotina = ler("src/lib/vistoria/laudo-servidor.ts");
  assert.match(rotina, /select\("id, agendado_para, visita_concluida_em, prazo_laudo_dias_uteis"\)\.eq\("status", "realizada"\)\.is\("laudo_atrasado_em", null\)/);
  assert.match(rotina, /laudoAtrasado\(visita, null, agora, p\.prazo_laudo_dias_uteis\)/);
  assert.match(rotina, /motivo: `Laudo não enviado no prazo combinado: \$\{diasUteis\(diasUteisDoLaudo\(p\.prazo_laudo_dias_uteis\)\)\} depois da visita\.`/);
  assert.doesNotMatch(rotina, /48 h/);
});

test("E1156: a conduta conta o laudo fora do combinado — dias úteis depois da visita; o pedido antigo, como antes", () => {
  const novo = { proposta_aceita_em: "2026-10-01T12:00:00Z", prazo_proposto_dias: 2, prazo_laudo_dias_uteis: 2, visita_concluida_em: VISITA, agendado_para: null };
  // O aceite foi 18 dias antes da visita: pela conta antiga (dias corridos desde o aceite) estaria sempre fora.
  assert.equal(laudoForaDoCombinado(novo, "2026-10-21T12:00:00Z"), false);
  assert.equal(laudoForaDoCombinado(novo, "2026-10-21T13:00:01Z"), true);
  assert.equal(laudoForaDoCombinado({ ...novo, visita_concluida_em: null, agendado_para: VISITA }, "2026-10-21T13:00:01Z"), true);
  assert.equal(laudoForaDoCombinado({ ...novo, visita_concluida_em: null }, "2026-10-21T13:00:01Z"), false, "sem data de visita não há como dizer que atrasou");
  // Pedido anterior à regra: N dias corridos depois do aceite, como foi prometido.
  const antigo = { proposta_aceita_em: "2026-10-01T12:00:00Z", prazo_proposto_dias: 7, prazo_laudo_dias_uteis: null, visita_concluida_em: VISITA, agendado_para: null };
  assert.equal(laudoForaDoCombinado(antigo, "2026-10-08T11:00:00Z"), false);
  assert.equal(laudoForaDoCombinado(antigo, "2026-10-08T13:00:00Z"), true);
  assert.equal(laudoForaDoCombinado({ ...antigo, prazo_proposto_dias: null }, "2026-12-01T00:00:00Z"), false);
  const servidor = ler("src/lib/vistoria/servidor.ts");
  assert.match(servidor, /select\("id, proposta_aceita_em, prazo_proposto_dias, prazo_laudo_dias_uteis, visita_concluida_em, agendado_para"\)/);
  assert.match(servidor, /if \(em && laudoForaDoCombinado\(x, em\)\) foraDoPrazo\+\+;/);
});

test("E1156: a proposta grava o prazo novo; o pedido que volta ao dono perde-o com o resto da proposta", () => {
  const acoes = ler("src/lib/vistoria/actions.ts");
  assert.match(acoes, /update\(\{ valor_proposto: v\.valor, prazo_proposto_dias: v\.prazoDias, prazo_laudo_dias_uteis: v\.prazoDias, proposta_em: agora, atualizado_em: agora \}\)/);
  const servidor = ler("src/lib/vistoria/servidor.ts");
  assert.match(servidor, /valor_proposto: null, prazo_proposto_dias: null, prazo_laudo_dias_uteis: null, proposta_em: null/);
});

test("E1156: as '48 horas úteis' saem de todo o lado da avaliação", () => {
  for (const arq of [
    "src/lib/vistoria/regras.ts",
    "src/lib/vistoria/laudo.ts",
    "src/lib/vistoria/telas-exibicao.ts",
    "src/lib/vistoria/telas-laudo.ts",
    "src/lib/vistoria/rotulos-da-fila.ts",
    "src/lib/vistoria/laudo-servidor.ts",
    "src/lib/vistoria/laudo-actions.ts",
    "src/app/(dashboard)/admin/avaliadores/page.tsx",
    "src/app/(dashboard)/dashboard/parceiro/avaliacao/[pedido]/page.tsx",
    "src/components/vistoria/bloco-avaliacao-dono.tsx",
  ]) {
    assert.doesNotMatch(ler(arq), /48 horas úteis|HORAS_UTEIS_LAUDO/, arq);
  }
  assert.equal(INCLUI_SEMPRE[1], "O laudo no prazo combinado com o avaliador.");
  assert.equal(ROTULO_FILA.laudo_atrasado, "Laudo não enviado no prazo combinado");
  assert.equal(TITULO_LAUDOS_FORA_DO_PRAZO, "Laudos fora do prazo combinado");
  assert.equal(ROTULO_NUMERO_LAUDOS_FORA_DO_PRAZO, "laudos fora do prazo combinado");
  assert.equal(contagemContestacoes({ contestacoes: 0, devolucoes: 0, laudosAtrasados: 3, auditoria: 0 }).find((n) => n.chave === "laudos-atrasados")?.rotulo, ROTULO_NUMERO_LAUDOS_FORA_DO_PRAZO);
  assert.match(ler("src/app/(dashboard)/admin/avaliadores/page.tsx"), /<h3 className="font-semibold text-ink">\{TITULO_LAUDOS_FORA_DO_PRAZO\}<\/h3>/);
});

test("E1156: depois da visita, o dono lê a data do laudo; o avaliador lê o prazo dele com os dias úteis combinados", () => {
  const p = { status: "realizada", aguardandoAvaliador: false, ocupado: false, concordanciaEm: null, agendadoPara: VISITA };
  assert.equal(situacaoDono({ ...p, laudoAte: "21/10/2026" }), "Visita feita: o laudo sai até 21/10/2026.");
  assert.equal(situacaoDono(p), "Visita feita: o laudo sai no prazo combinado com o avaliador.");
  // O avaliador: a mesma conta, com o prazo dele escrito.
  assert.equal(prazoDoLaudo(VISITA, new Date("2026-10-19T15:00:00Z")).texto, "Envie até 21/10/2026 às 10:00, horário de Brasília (2 dias úteis depois da visita).");
  assert.equal(prazoDoLaudo(VISITA, new Date("2026-10-19T15:00:00Z"), 5).texto, "Envie até 26/10/2026 às 10:00, horário de Brasília (5 dias úteis depois da visita).");
  assert.equal(prazoDoLaudo(VISITA, new Date("2026-10-19T15:00:00Z"), 1).texto, "Envie até 20/10/2026 às 10:00, horário de Brasília (1 dia útil depois da visita).");
  const vencido = prazoDoLaudo(VISITA, new Date("2026-10-23T15:00:00Z"));
  assert.deepEqual(vencido, { vencido: true, texto: "Prazo combinado vencido em 21/10/2026 às 10:00. Envie agora: a Viva acompanha os atrasos." });
  assert.equal(prazoDoLaudo(VISITA, new Date("2026-10-23T15:00:00Z"), 5).vencido, false);
  // As telas passam o prazo do pedido.
  const bloco = ler("src/components/vistoria/bloco-avaliacao-dono.tsx");
  assert.match(bloco, /prazo_laudo_dias_uteis/);
  assert.match(bloco, /laudoAte: laudoAteDoPedido/);
  const pedido = ler("src/app/(dashboard)/dashboard/parceiro/avaliacao/[pedido]/page.tsx");
  assert.match(pedido, /prazoDoLaudo\(visitaEm, new Date\(\), p\.prazo_laudo_dias_uteis as number \| null\)/);
  assert.match(pedido, /envie o laudo no prazo combinado: \{diasUteis\(diasUteisDoLaudo\(p\.prazo_laudo_dias_uteis as number \| null\)\)\} depois da visita\./);
  const acoes = ler("src/lib/vistoria/laudo-actions.ts");
  assert.match(acoes, /mensagem: `Visita concluída\. \$\{prazoDoLaudo\(agora, new Date\(agora\), prazoDoPedido\)\.texto\}`/);
});

test("E1156: o dono vê o compromisso ao lado do valor — em dias úteis antes da data da visita, 'Laudo até' com ela marcada", () => {
  const novo = { prazo_proposto_dias: 3, prazo_laudo_dias_uteis: 3 };
  assert.equal(diasUteis(1), "1 dia útil");
  assert.equal(diasUteis(3), "3 dias úteis");
  assert.equal(prazoCombinadoNaLinhaDoDono(novo, null), "laudo em até 3 dias úteis depois da visita");
  // Visita na segunda 19/10 às 10:00: 3 dias úteis = quinta 22/10.
  assert.equal(prazoCombinadoNaLinhaDoDono(novo, VISITA), "Laudo até 22/10/2026");
  // Pedido anterior à regra: a promessa que recebeu, como estava escrita.
  const antigo = { prazo_proposto_dias: 7, prazo_laudo_dias_uteis: null };
  assert.equal(prazoCombinadoNaLinhaDoDono(antigo, null), "laudo em 7 dias");
  assert.equal(prazoCombinadoNaLinhaDoDono(antigo, VISITA), "laudo em 7 dias");
  assert.equal(prazoCombinadoNaLinhaDoDono({ prazo_proposto_dias: 1 }, VISITA), "laudo em 1 dia");
  const bloco = ler("src/components/vistoria/bloco-avaliacao-dono.tsx");
  assert.match(bloco, /Proposta do avaliador: \{brl\(Number\(atual\.valor_proposto\)\)\} · \{prazoCombinadoNaLinhaDoDono\(atual, null\)\}/);
  assert.match(bloco, /Combinado com o avaliador: \{brl\(Number\(atual\.valor_proposto\)\)\} · \{prazoCombinadoNaLinhaDoDono\(atual, visitaComData\)\}\./);
  // A confirmação da troca diz a mesma coisa que a proposta.
  assert.match(bloco, /prazoPorExtenso: prazoCombinadoNaLinhaDoDono\(atual, null\)/);
  assert.equal(textoDaTroca({ numero: "UDI-002", valor: "R$ 380,00", prazoDias: 3, prazoPorExtenso: "laudo em até 3 dias úteis depois da visita", outros: 2, cidade: null }).perde[1], "A proposta dele é descartada: R$ 380,00 · laudo em até 3 dias úteis depois da visita.");
});

test("E1156: o avaliador propõe em dias úteis depois da visita, com o teto, e lê o que propôs do mesmo jeito", () => {
  const lista = ler("src/app/(dashboard)/dashboard/parceiro/avaliacao/page.tsx");
  assert.match(lista, /Prazo do laudo \(dias úteis depois da visita, até \{PRAZO_LAUDO_MAX_DIAS_UTEIS\}\)<input name="prazoDias" type="number" min=\{1\} max=\{PRAZO_LAUDO_MAX_DIAS_UTEIS\}/);
  assert.match(lista, /\{textoDaPropostaEnviada\(p\)\}\./);
  assert.match(ler("src/app/(dashboard)/dashboard/parceiro/avaliacao/[pedido]/page.tsx"), /prazoMaxDias=\{PRAZO_LAUDO_MAX_DIAS_UTEIS\}/);
  assert.match(ler("src/components/avaliadores/aceitar-pedido.tsx"), /Prazo do laudo \(dias úteis depois da visita, até \{prazoMaxDias\}\)/);
  const base = { valor_tabela: 350, valor_proposto: 280, teste: false, escolhido_em: "2026-10-01T12:00:00Z" };
  const novo = { ...base, prazo_proposto_dias: 2, prazo_laudo_dias_uteis: 2 };
  const antigo = { ...base, prazo_proposto_dias: 5, prazo_laudo_dias_uteis: null };
  assert.equal(textoDaPropostaEnviada(novo), "Proposta enviada: R$ 280,00 · laudo em até 2 dias úteis depois da visita");
  assert.equal(textoDaPropostaEnviada(antigo), "Proposta enviada: R$ 280,00 em 5 dias");
  assert.deepEqual(linhaDoValor("proposta_enviada", novo), { texto: "Proposta enviada: R$ 280,00 · laudo em até 2 dias úteis depois da visita", recebe: false });
  assert.equal(linhaDoPrazoDoLaudo("aceito", novo), "Laudo em até 2 dias úteis depois da visita");
  assert.equal(linhaDoPrazoDoLaudo("aceito", antigo), "Laudo em 5 dias");
  assert.equal(resumoDoValorNaLista(novo), "R$ 280,00 · 2 dias úteis");
  assert.equal(resumoDoValorNaLista(antigo), "R$ 280,00 · 5 dias");
});

test("E1156 (ORDEM-774): o termo do perfil segue o teto da proposta — de 1 a 5 dias úteis, com a mesma frase de recusa", () => {
  // "Meus termos › Entrega do laudo" é a mesma promessa noutra superfície: não pode anunciar o que a proposta recusa.
  for (const n of [1, 2, 3, 4, 5]) assert.equal(validarTermos({ valor: 250, prazoEntregaDias: n, prazoRespostaHoras: 12 }).ok, true, `${n} dias`);
  const acima = validarTermos({ valor: 250, prazoEntregaDias: PRAZO_LAUDO_MAX_DIAS_UTEIS + 1, prazoRespostaHoras: 12 });
  assert.deepEqual(acima, { ok: false, erro: "Informe o prazo do laudo em dias úteis inteiros, de 1 a 5, contados depois da visita." });
  // A frase é a MESMA da proposta, letra por letra.
  assert.deepEqual(acima, validarProposta({ valor: 250, prazoDias: PRAZO_LAUDO_MAX_DIAS_UTEIS + 1 }, f));
  for (const fora of [0, -1, 2.5, 30, Number.NaN]) assert.deepEqual(validarTermos({ valor: 250, prazoEntregaDias: fora, prazoRespostaHoras: 12 }), acima, `fora da regra (${fora})`);
  // O campo do perfil trava no mesmo teto, lido da fonte única dos prazos; o teto antigo de 30 não sobra em lado nenhum.
  const lista = ler("src/app/(dashboard)/dashboard/parceiro/avaliacao/page.tsx");
  assert.match(lista, /<input name="prazoEntregaDias" type="number" min=\{1\} max=\{PRAZO_LAUDO_MAX_DIAS_UTEIS\}/);
  assert.doesNotMatch(lista, /PRAZO_PROPOSTA_MAX_DIAS/);
  assert.doesNotMatch(ler("src/lib/vistoria/escolha.ts"), /PRAZO_PROPOSTA_MAX_DIAS/);
});

test("E1156: a migração 0361 só acrescenta a coluna opcional, com o teto, e tem o aplicar e o rollback", () => {
  const m = readFileSync("supabase/migrations/0361_vistoria_prazo_do_laudo_combinado_e1156.sql", "utf8");
  assert.match(m, /alter table public\.vistoria_pedidos\s+add column if not exists prazo_laudo_dias_uteis smallint\s+check \(prazo_laudo_dias_uteis is null or \(prazo_laudo_dias_uteis between 1 and 5\)\);/);
  const a = readFileSync("supabase/producao/aplicar-0361.sql", "utf8");
  assert.match(a, /^begin;$/m);
  assert.match(a, /^commit;$/m);
  assert.match(a, /add column if not exists prazo_laudo_dias_uteis smallint/);
  assert.match(a, /'20261124000361', '0361_vistoria_prazo_do_laudo_combinado_e1156'/);
  assert.match(readFileSync("supabase/producao/rollback/0361_rollback.sql", "utf8"), /alter table public\.vistoria_pedidos drop column if exists prazo_laudo_dias_uteis;/);
});
