import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * Resíduo da varredura ampla: a devolução da caução não age sobre leitura falha nem emite o termo duas vezes.
 */
const fonte = readFileSync(new URL("./documentos-actions.ts", import.meta.url), "utf8");
function corpo(nome: string): string {
  const i = fonte.indexOf(`export async function ${nome}(`);
  assert.ok(i >= 0, `${nome} existe`);
  const j = fonte.indexOf("\nexport ", i + 1);
  return fonte.slice(i, j < 0 ? undefined : j);
}

test("registrarDevolucaoCaucao: falha ao ler cauções ou acertos abertos para antes do insert", () => {
  const c = corpo("registrarDevolucaoCaucao");
  assert.match(c, /error: erroCaucoes/);
  assert.match(c, /error: erroAbertos/);
  const guarda = c.search(/if \(erroCaucoes \|\| erroAbertos\) return \{ ok: false/);
  assert.ok(guarda >= 0, "guarda da leitura");
  assert.ok(guarda < c.indexOf("regraDevolucao("), "guarda antes da regra (e do insert)");
});

test("responderDevolucaoCaucao: leitura falha não vira 'não encontrada'", () => {
  const c = corpo("responderDevolucaoCaucao");
  const guarda = c.search(/if \(erroAcerto\) return \{ ok: false, error: "Não foi possível registrar agora\. Tente de novo\." \}/);
  assert.ok(guarda >= 0);
  assert.ok(guarda < c.indexOf("if (!a) return"));
});

test("responderDevolucaoCaucao: só a resposta que mudou o status emite o termo", () => {
  const c = corpo("responderDevolucaoCaucao");
  assert.match(c, /\.eq\("status", "aguardando_confirmacao"\)\s*\.select\("id"\)/);
  const checa = c.indexOf("if (!mudou?.length) return");
  assert.ok(checa >= 0, "confere a linha mudada");
  assert.ok(checa < c.indexOf("emitirTermoDevolucaoComRegistro"), "antes de emitir o termo");
});
