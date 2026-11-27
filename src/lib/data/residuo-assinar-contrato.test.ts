import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * Resíduo da varredura ampla: o que vai para o contrato assinado (regras congeladas, valores vivos do hash e o hash da
 * outra parte) nunca sai de leitura falha transformada em 0 / null / "ainda não assinou".
 */
const fonte = readFileSync(new URL("./contrato-assinar-actions.ts", import.meta.url), "utf8");
function corpo(nome: string): string {
  const i = fonte.search(new RegExp(`(export )?async function ${nome}\\(`));
  assert.ok(i >= 0, `${nome} existe`);
  const j = fonte.indexOf("\n}\n", i);
  return fonte.slice(i, j + 2);
}

test("as leituras vivas têm modo estrito que lança em vez de 0 / null", () => {
  assert.match(corpo("contarPetsDoInquilino"), /if \(error && estrito\) throw new LeituraDaAssinaturaFalhou/);
  assert.match(corpo("lerOutrosCustosVivos"), /if \(error\) throw new LeituraDaAssinaturaFalhou/);
  assert.match(corpo("lerOutrosCustosVivos"), /if \(estrito\) throw/);
  const limpeza = corpo("lerLimpezaViva");
  assert.match(limpeza, /if \(error && error\.code !== COLUNA_AUSENTE\) throw new LeituraDaAssinaturaFalhou/);
  assert.match(limpeza, /if \(estrito\) throw/);
});

test("prepararParaAssinar: congelamento e valores vivos só no modo estrito, com erro de gravação conferido", () => {
  const p = corpo("prepararParaAssinar");
  assert.match(p, /contarPetsDoInquilino\(c\.tenant_id, true\)/);
  assert.equal((p.match(/lerLimpezaViva\(c\.property_id, true\)/g) ?? []).length, 2);
  assert.equal((p.match(/lerOutrosCustosVivos\(c\.property_id, true\)/g) ?? []).length, 2);
  assert.match(p, /if \(erroCongela\) throw/);
  assert.match(p, /if \(erroPacote\) throw/);
  assert.match(p, /completarPets\(c, true\)/);
  assert.match(corpo("lerContrato"), /if \(error\) throw new LeituraDaAssinaturaFalhou/);
});

test("assinarContrato: leitura falha devolve 'tente de novo' e nunca grava", () => {
  const a = corpo("assinarContrato");
  assert.match(a, /c = await prepararParaAssinar\(admin, input\.contratoId\)/);
  assert.match(a, /if \(!\(e instanceof LeituraDaAssinaturaFalhou\)\) throw e;[\s\S]*?return \{ ok: false, error: MSG_ASSINATURA_SEM_LEITURA \}/);
  assert.doesNotMatch(a, /completarPets\(c\)/);
});

test("assinarContrato: o hash da outra parte é lido com erro conferido, antes de consumir o código", () => {
  const a = corpo("assinarContrato");
  const leitura = a.indexOf("error: erroOutra");
  const guarda = a.indexOf("if (erroOutra) return { ok: false, error: MSG_ASSINATURA_SEM_LEITURA }");
  const consome = a.indexOf('.update({ usado_em: new Date().toISOString() })');
  assert.ok(leitura >= 0 && guarda > leitura, "lê e confere");
  assert.ok(guarda < consome, "antes de consumir o código");
});

test("pedirCodigoAssinatura: leitura falha não fura o limite de 1 minuto", () => {
  const p = corpo("pedirCodigoAssinaturaInterno"); // E654: a lógica mora na função interna (a pública só captura exceções)
  const guarda = p.indexOf("if (erroAtual) return");
  assert.ok(guarda >= 0 && guarda < p.indexOf("podeReenviar("));
});
