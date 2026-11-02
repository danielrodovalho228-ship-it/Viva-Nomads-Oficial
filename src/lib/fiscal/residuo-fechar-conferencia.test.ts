import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * Resíduo da varredura ampla: o fechamento da conferência (gravado uma vez, sem volta) nunca sai de leitura falha.
 */
const fonte = readFileSync(new URL("./conferencia-fechamento.ts", import.meta.url), "utf8");
function corpo(nome: string): string {
  const i = fonte.indexOf(`export async function ${nome}(`);
  assert.ok(i >= 0, `${nome} existe`);
  const j = fonte.indexOf("\nexport ", i + 1);
  return fonte.slice(i, j < 0 ? undefined : j);
}

test("fecharConferencia: erro ao ler a conferência, itens, respostas ou laudo para antes do fechar_conferencia", () => {
  const c = corpo("fecharConferencia");
  for (const e of ["erroConferencia", "erroItens", "erroRespostas", "erroLaudo", "erroConforto"]) assert.match(c, new RegExp(`error: ${e}`), e);
  const guarda = c.search(/if \(falha\) throw/);
  assert.ok(guarda >= 0, "guarda da leitura");
  assert.ok(guarda < c.indexOf('rpc("fechar_conferencia"'), "antes de gravar o hash");
  assert.ok(c.indexOf("if (erroConferencia) throw") < c.indexOf("if (!c || c.fechada_em)"), "conferência não lida não vira 'já fechada'");
});

test("fecharConferencia: só a tabela do conforto ausente é tolerada", () => {
  const c = corpo("fecharConferencia");
  assert.match(c, /erroConforto && erroConforto\.code !== TABELA_AUSENTE/);
  assert.match(fonte, /const TABELA_AUSENTE = "42P01"/);
});

test("fecharConferencia: a falha avisa o Daniel (P2) e não lança", () => {
  const c = corpo("fecharConferencia");
  const captura = c.slice(c.indexOf("} catch (e) {"));
  assert.match(captura, /from\("avisos_daniel"\)\s*\.insert\(/);
  assert.match(captura, /prioridade: "P2"/);
  assert.match(captura, /\.then\(undefined, \(\) => \{\}\)/);
  assert.match(captura, /return \{ fechou: false \}/);
});

test("corrigirConferenciaFechada: leitura falha pede para tentar de novo, antes do insert", () => {
  const c = corpo("corrigirConferenciaFechada");
  const a = c.indexOf("if (erroConferencia) return");
  const b = c.indexOf("if (erroUltima) return");
  assert.ok(a >= 0 && a < c.indexOf("if (!c?.fechamento_hash)"));
  assert.ok(b >= 0 && b < c.indexOf('from("conferencia_correcoes").insert'));
});
