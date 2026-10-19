/*
  Prompt 29 — "uma fonte só por indicador": agregados do financeiro, resolvidos do atendimento, resposta a pedidos,
  fila de documentos, definições de agentes, tipo de imóvel e a guarda do fuso de Brasília no admin.
  Roda: node --test src/lib/admin/indicadores.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  AGENTES_DEFINICOES,
  agregarContratos,
  apareceParaPublico,
  ehRegraAnterior,
  faltaAssinar,
  fmtTempoMin,
  mediana,
  mesesDoContrato,
  periodoDaLista,
  resolvidosAtendimento,
  respostaPedidos,
  textoFilaDocumentos,
  tipoImovel,
} from "./indicadores.ts";
import { BLOCOS, diasAteHoje, qsPeriodo } from "./visao-geral.ts";
import { dataBRT, dataHoraBRT, horaBRT } from "../datas-brasilia.ts";

const UUID = "0b3f1f9e-6c0a-4a43-9a51-3f6a8c3a2d11";

test("item 6: 3.200 × 4 → valor total 12.800, taxa 1.536, take rate 12%", () => {
  const ag = agregarContratos([{ aluguelMensal: 3200, prazoDias: 120, taxaValor: 1536, taxaPercent: 0.12 }]);
  assert.equal(ag.valorTotal, 12800);
  assert.equal(ag.taxa, 1536);
  assert.equal(ag.takeRate, 0.12);
  assert.equal(ag.valorMensalSoma, 3200);
  assert.equal(ag.contratos, 1);
});

test("item 6: a taxa é a soma das GRAVADAS (nunca % reaplicado) e a regra anterior entra pelo valor gravado", () => {
  const antigo = { aluguelMensal: 3000, prazoDias: 180, taxaValor: 360, taxaPercent: 0.12 }; // 12% de 1 mês só
  assert.equal(ehRegraAnterior(antigo), true);
  assert.equal(ehRegraAnterior({ aluguelMensal: 3200, prazoDias: 120, taxaValor: 1536, taxaPercent: 0.12 }), false);
  const ag = agregarContratos([antigo, { aluguelMensal: 3200, prazoDias: 120, taxaValor: 1536, taxaPercent: 0.12 }]);
  assert.equal(ag.valorTotal, 3000 * 6 + 12800);
  assert.equal(ag.taxa, 360 + 1536);
  assert.equal(ag.regraAnterior, 1);
  assert.equal(agregarContratos([]).takeRate, null, "sem contrato: —, não 0%");
  assert.equal(mesesDoContrato(45), 2);
  assert.equal(mesesDoContrato(10), 1);
  assert.equal(mesesDoContrato(null), 0);
});

test("item 7: resolvidos = (resolvidos + encerrados) ÷ total; minutos abaixo de 1 h", () => {
  assert.equal(resolvidosAtendimento({ total: 6, resolvidos: 2, encerradosSemResolucao: 4 }), 1);
  assert.equal(resolvidosAtendimento({ total: 4, resolvidos: 1, encerradosSemResolucao: 1 }), 0.5);
  assert.equal(resolvidosAtendimento({ total: 0, resolvidos: 0, encerradosSemResolucao: 0 }), null);
  assert.equal(fmtTempoMin(26.4), "26 min");
  assert.equal(fmtTempoMin(79.2), "1,3 h");
  assert.equal(fmtTempoMin(null), "—");
});

test("item 8: pedidos com resposta e mediana do tempo até a 1ª resposta", () => {
  const h = (n: number) => new Date(Date.UTC(2026, 9, 1) + n * 3_600_000).toISOString();
  const r = respostaPedidos([
    { criadoEm: h(0), primeiraRespostaEm: h(1) },
    { criadoEm: h(0), primeiraRespostaEm: h(3) },
    { criadoEm: h(0), primeiraRespostaEm: null },
    { criadoEm: h(0), primeiraRespostaEm: null },
  ]);
  assert.deepEqual(r, { total: 4, comResposta: 2, taxa: 0.5, medianaHoras: 2 });
  assert.equal(respostaPedidos([]).taxa, null);
  assert.equal(mediana([5, 1, 3]), 3);
});

test("item 9: fila de documentos = documentos + matrículas, com a soma explicada", () => {
  assert.equal(textoFilaDocumentos({ documentos: 2, matriculas: 2 }), "4 na fila (2 documentos + 2 matrículas)");
  assert.equal(textoFilaDocumentos({ documentos: 1, matriculas: 0 }), "1 na fila (1 documento + 0 matrículas)");
});

test("item 10: agentes com nome; o selo da barra lateral mostra só 'Aguardando o seu OK'", () => {
  assert.equal(AGENTES_DEFINICOES.aguardandoOk.rotulo, "Aguardando o seu OK");
  assert.equal(AGENTES_DEFINICOES.ordensPendentes.rotulo, "Ordens pendentes");
  assert.equal(AGENTES_DEFINICOES.ordensLidas.rotulo, "Ordens lidas não concluídas");
  const shell = readFileSync("src/components/layout/dashboard-shell.tsx", "utf8");
  assert.match(shell, /"admin-agentes": aprovacoesPendentes/);
  const acoes = readFileSync("src/lib/data/agentes-actions.ts", "utf8");
  assert.match(acoes, /contarAguardandoOk\(admin\)/);
  const docs = readFileSync("src/lib/data/documentos-admin.ts", "utf8");
  assert.match(docs, /\(await filaDocumentos\(admin\)\)\.total/, "selo de Documentos = a fila da home");
});

test("item 13: real × demonstração × teste e 'aparece para o público'", () => {
  assert.equal(tipoImovel({ id: "ube-001", titulo: "Studio" }), "demonstracao");
  assert.equal(tipoImovel({ id: UUID, titulo: "[TESTE QA] Casa" }), "teste");
  assert.equal(tipoImovel({ id: UUID, titulo: "Casa", donoTeste: true }), "teste");
  assert.equal(tipoImovel({ id: UUID, titulo: "Casa" }), "real");
  assert.equal(apareceParaPublico("real", "active", false), true);
  assert.equal(apareceParaPublico("real", "draft", true), false);
  assert.equal(apareceParaPublico("demonstracao", "active", true), true);
  assert.equal(apareceParaPublico("demonstracao", "active", false), false);
  assert.equal(apareceParaPublico("teste", "active", true), false);
});

test("item 1: todo número da home com lista abre a lista com o mesmo período; manutenção ≠ atendimento", () => {
  const f = { inicio: "2026-10-01", fim: "2026-10-19", cidade: null };
  assert.equal(qsPeriodo(f), "periodo=custom&de=2026-10-01&ate=2026-10-19");
  const todos = BLOCOS.flatMap((b) => b.indicadores);
  const por = (k: string) => todos.find((i) => i.chave === k)!;
  assert.equal(por("chamados").rotulo, "Solicitações de manutenção abertas");
  assert.match(por("chamados").href!(f), /^\/admin\/solicitacoes\?/);
  assert.equal(por("atendimento_abertos").rotulo, "Atendimento: chamados abertos");
  assert.equal(por("atendimento_abertos").href!(f), "/admin/atendimento?aba=fila");
  assert.match(por("contratos").href!(f), /^\/admin\/contratos\?periodo=custom&de=2026-10-01&ate=2026-10-19$/);
  assert.equal(por("valor_mensal_contratado").rotulo, "Valor mensal contratado (soma)");
  assert.ok(!todos.some((i) => i.rotulo === "Aluguel contratado"), "o rótulo antigo saiu");
  for (const b of BLOCOS) assert.equal(b.indicadores.length % 2, 0, `bloco ${b.id} com grade par`);
  assert.equal(diasAteHoje({ inicio: "2026-10-01" }, "2026-10-19"), 19);
  assert.deepEqual(periodoDaLista({ de: "2026-10-01", ate: "2026-10-19" }), { inicio: "2026-10-01", fim: "2026-10-19" });
  assert.equal(periodoDaLista({ de: "2026-02-31", ate: "2026-10-19" }), null);
  assert.equal(periodoDaLista({ de: "2026-10-19", ate: "2026-10-01" }), null);
});

test("contratos: 'falta assinar: quem'", () => {
  assert.equal(faltaAssinar({ assinadoDono: false, assinadoInquilino: false }), "Falta assinar: proprietário e inquilino");
  assert.equal(faltaAssinar({ assinadoDono: true, assinadoInquilino: false }), "Falta assinar: inquilino");
  assert.equal(faltaAssinar({ assinadoDono: true, assinadoInquilino: true }), "Assinado pelas duas partes");
});

test("item 11: formatador único de Brasília", () => {
  assert.equal(dataHoraBRT("2026-10-19T17:32:00Z"), "19/10/2026 14:32 (horário de Brasília)");
  assert.equal(dataHoraBRT("2026-10-19T17:32:00Z", { tabela: true }), "19/10/2026 14:32 BRT");
  assert.equal(dataHoraBRT("2026-10-20T02:10:00Z", { semEtiqueta: true }), "19/10/2026 23:10");
  assert.equal(dataBRT("2026-10-20T02:10:00Z"), "19/10/2026");
  assert.equal(horaBRT("2026-10-19T17:32:00Z"), "14:32");
  assert.equal(dataHoraBRT(null), "—");
  assert.equal(dataHoraBRT("lixo"), "—");
});

/** Arquivos .ts/.tsx de uma pasta (recursivo). */
function arquivos(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return arquivos(p);
    return /\.tsx?$/.test(n) && !/\.test\.tsx?$/.test(n) ? [p] : [];
  });
}

test("guarda (item 11): datas e horas do admin só pelo formatador único (datas-brasilia)", () => {
  const PROIBIDO = /toLocale(Date|Time)String\(|toLocaleString\([^)]*(timeZone|hour|day|dateStyle)|Intl\.DateTimeFormat|dataHoraBrasilia\(|abertoEmBR\(/;
  // Exceções, uma por motivo: o relógio do Texas (fuso dos EUA, de propósito) e o nome do mês do marketing (não é horário).
  const EXCECAO = /America\/Chicago|month: "long"/;
  const achados: string[] = [];
  for (const f of [...arquivos("src/app/(dashboard)/admin"), ...arquivos("src/components/admin")]) {
    readFileSync(f, "utf8")
      .split("\n")
      .forEach((l, i) => {
        if (PROIBIDO.test(l) && !EXCECAO.test(l)) achados.push(`${f}:${i + 1}`);
      });
  }
  assert.deepEqual(achados, [], "use dataHoraBRT/dataBRT/horaBRT de src/lib/datas-brasilia.ts");
});
