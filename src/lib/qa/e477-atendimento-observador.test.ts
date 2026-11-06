/*
  E477 (reprova da rodada 8): o Atendimento ficou de fora da 1ª correção — "Salvar resposta pronta", "Rodar os 14
  cenários", responder, aprovar, avaliar e mudar o chamado seguiam habilitados para a conta observadora da QA. Chamado
  não tem alvo de teste (é conversa com pessoa real, e-mail incluído): o observador só lê, sempre.
  Roda: node --test src/lib/qa/e477-atendimento-observador.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
const acoes = ler("lib/data/atendimento-actions.ts");

function corpo(fn: string): string {
  const i = acoes.indexOf(`export async function ${fn}(`);
  assert.ok(i >= 0, fn);
  const fim = acoes.indexOf("\nexport ", i + 10);
  return acoes.slice(i, fim > 0 ? fim : undefined);
}

test("servidor: escrita do Atendimento recusa o observador sempre (sem alvo) e antes de gravar", () => {
  assert.match(acoes, /import \{ recusaObservador \} from "@\/lib\/qa\/observador";/);
  for (const fn of ["responderComoAdmin", "aprovarSugestao", "alterarChamado", "salvarMacro", "apagarMacro", "avaliarRespostaIA", "testarViva", "devolverParaViva"]) {
    const c = corpo(fn);
    const g = c.indexOf("await recusaObservador(ctx.userId)");
    assert.ok(g > 0, `${fn}: sem recusaObservador`);
    const primeiraEscrita = c.slice(c.indexOf("\n")).search(/\.(insert|update|delete|upsert)\(|rpc\(|chamarClaude|devolverChamadoParaViva|responderComoAdmin\(/);
    assert.ok(primeiraEscrita < 0 || g - c.indexOf("\n") < primeiraEscrita, `${fn}: a guarda vem depois de uma escrita`);
  }
});

test("tela do chamado: o observador não vê responder, aprovar, avaliar nem ações", () => {
  const t = ler("app/(dashboard)/admin/atendimento/[id]/chamado-client.tsx");
  assert.match(t, /import \{ SoLeituraQa \} from "@\/components\/admin\/so-leitura-qa";/);
  assert.match(t, /!observadorQa && respostaDaSugestao\(m\.corpo\)/);
  assert.match(t, /m\.autor === "ia" && !m\.interno && !observadorQa/);
  assert.match(t, /c\.status !== "encerrado" && !observadorQa && \(/);
  assert.match(t, /observadorQa \? <SoLeituraQa \/> : \(/);
});

test("tela da lista: a aba Respostas prontas e o teste da Viva saem para o observador", () => {
  const p = ler("app/(dashboard)/admin/atendimento/page.tsx");
  assert.match(p, /const soLeitura = \(await soLeituraNaTela\(\[\{ id: "configuracao" \}\]\)\)\.length > 0;/);
  assert.match(p, /soLeitura=\{soLeitura\}/);
  const c = ler("app/(dashboard)/admin/atendimento/atendimento-client.tsx");
  assert.match(c, /import \{ SoLeituraQa \} from "@\/components\/admin\/so-leitura-qa";/);
  assert.match(c, /soLeitura \? <SoLeituraQa/);
});

test("servidor: reenvio e emissão de documentos e decisão do vínculo recusam o observador (mandam a pessoas reais)", () => {
  const casos: [string, string[], RegExp][] = [
    ["lib/data/emitidos-actions.ts", ["reenviarEmitido"], /await recusaObservador\(c\.userId\)/],
    ["lib/data/documentos-falhas-actions.ts", ["emitirDeNovo", "reenviarEmail", "emitirPendentes"], /await recusaObservador\(c\.userId\)/],
    ["lib/data/triagem-actions.ts", ["decidirVinculo"], /await recusaObservador\(s\.userId\)/],
  ];
  for (const [arq, fns, regra] of casos) {
    const s = ler(arq);
    assert.match(s, /import \{ recusaObservador \} from "@\/lib\/qa\/observador";/, arq);
    for (const fn of fns) {
      const i = s.indexOf(`export async function ${fn}(`);
      assert.ok(i >= 0, fn);
      const fim = s.indexOf("\nexport ", i + 10);
      const c = s.slice(i, fim > 0 ? fim : undefined);
      assert.match(c, regra, `${arq} › ${fn}`);
      const g = c.search(regra);
      const escrita = c.slice(c.indexOf("\n")).search(/\.(insert|update|delete|upsert)\(|reenviarEmailDoDocumento|emitirDoPagamentoComRegistro|emitirTermoDevolucaoComRegistro|consumirLimite/);
      assert.ok(escrita < 0 || g - c.indexOf("\n") < escrita, `${arq} › ${fn}: guarda depois da escrita`);
    }
  }
});

test("tela de documentos: Emitidos, Falhas e Vínculos tiram os botões para o observador", () => {
  const p = ler("app/(dashboard)/admin/documentos/page.tsx");
  assert.match(p, /const soLeituraConfig = \(await soLeituraNaTela\(\[\{ id: "configuracao" \}\]\)\)\.length > 0;/);
  assert.match(p, /<EmitidosAdmin [^>]*soLeitura=\{soLeituraConfig\}/);
  assert.match(p, /<FalhasDocumentos [^>]*soLeitura=\{soLeituraConfig\}/);
  assert.match(p, /<VinculosAdmin [^>]*soLeitura=\{soLeituraConfig\}/);
  for (const a of ["emitidos-client.tsx", "falhas-client.tsx", "vinculos-admin-client.tsx"]) {
    const c = ler(`app/(dashboard)/admin/documentos/${a}`);
    assert.match(c, /SoLeituraQa/, a);
    assert.match(c, /soLeitura/, a);
  }
});
