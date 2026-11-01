import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");

test("achado 41: as provas do contrato no admin não saem incompletas quando uma leitura falha", () => {
  const dados = ler("../data/contrato-admin.ts");
  assert.match(dados, /function semFalhaDeLeitura[\s\S]*?if \(falha\) throw new Error/);
  // As duas rodadas (contrato, assinaturas, pagamentos, conferências, aditivos; itens, respostas, laudos) passam pela checagem
  // ANTES de montar as provas.
  assert.equal((dados.match(/semFalhaDeLeitura\(rodada[12]\);/g) ?? []).length, 2);
  assert.ok(dados.indexOf("semFalhaDeLeitura(rodada2);") < dados.indexOf("montarDadosProvas({"));

  // O pacote registrado (PDF) não é gerado com leitura incompleta: responde 503.
  const rota = ler("../../app/api/admin/contratos/[id]/provas/route.ts");
  assert.match(rota, /carregarContratoAdmin\(id\)\.catch\(/);
  assert.ok(rota.indexOf('if (c === "falha") return NextResponse.json') < rota.indexOf("gerarPacoteProvasRegistrado("));
  assert.match(rota, /status: 503/);
});
