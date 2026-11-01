/*
  Prompt 58 — resumo da semana na seção "Dados e retenção".
  Roda: node --test src/lib/minimizacao/painel.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { resumoDaSemana } from "./painel.ts";

test("só os últimos 7 dias; contas de teste à parte", () => {
  const agora = new Date("2026-11-10T12:00:00Z");
  const r = resumoDaSemana(
    [
      { tipo: "inquilino-docs/recusado", motivo: "prazo", teste: false, eliminado_em: "2026-11-09T03:00:00Z" },
      { tipo: "inquilino-docs/recusado", motivo: "prazo", teste: true, eliminado_em: "2026-11-09T03:00:00Z" },
      { tipo: "property-photos", motivo: "decisao", teste: false, eliminado_em: "2026-11-05T03:00:00Z" },
      { tipo: "property-photos", motivo: "decisao", teste: false, eliminado_em: "2026-11-01T03:00:00Z" },
    ],
    agora,
  );
  assert.equal(r.total, 2);
  assert.equal(r.teste, 1);
  assert.deepEqual(r.porItem, [
    { tipo: "inquilino-docs/recusado", motivo: "prazo", n: 1, teste: 1 },
    { tipo: "property-photos", motivo: "decisao", n: 1, teste: 0 },
  ]);
});

test("E333: o 'hoje' da Retenção é o dia da leitura; antes da rodada das 10h, a nota diz de quando são os números", async () => {
  const { cabecalhoRelatorioHoje } = await import("./painel.ts");
  // 01/11/2026 às 08h BRT: o último relatório é o de 31/10 às 10h.
  const cedo = cabecalhoRelatorioHoje("2026-10-31", "2026-10-31T13:00:19Z", new Date("2026-11-01T11:00:00Z"));
  assert.equal(cedo.titulo, "O que seria apagado hoje (01/11/2026)");
  assert.match(cedo.nota!, /ainda não saiu/);
  assert.match(cedo.nota!, /31\/10\/2026 às 10:00/);
  // Depois da rodada do dia: mesma data, nota curta.
  const depois = cabecalhoRelatorioHoje("2026-11-01", "2026-11-01T13:00:20Z", new Date("2026-11-01T18:00:00Z"));
  assert.equal(depois.titulo, "O que seria apagado hoje (01/11/2026)");
  assert.equal(depois.nota, "Rodada de hoje às 10:00.");
  // 23h30 BRT de 01/11 já é 02/11 em UTC: o "hoje" segue 01/11.
  assert.equal(cabecalhoRelatorioHoje("2026-11-01", null, new Date("2026-11-02T02:30:00Z")).titulo, "O que seria apagado hoje (01/11/2026)");
  assert.equal(cabecalhoRelatorioHoje(null, null, new Date("2026-11-01T11:00:00Z")).nota, null);
});

test("E333: a página da Retenção é dinâmica e o relatório grava o dia de Brasília", async () => {
  const { readFileSync } = await import("node:fs");
  const pg = readFileSync(new URL("../../app/(dashboard)/admin/retencao/page.tsx", import.meta.url), "utf8");
  assert.match(pg, /export const dynamic = "force-dynamic"/);
  assert.match(pg, /cabecalhoRelatorioHoje\(dia,/);
  assert.doesNotMatch(pg, /O que seria apagado hoje \(\$\{dataBRT\(`\$\{dia\}/);
  const srv = readFileSync(new URL("./servidor.ts", import.meta.url), "utf8");
  assert.match(srv, /const dia = diaBRT\(agora\)!/);
});
