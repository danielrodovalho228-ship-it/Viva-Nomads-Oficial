import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/** Resíduo da varredura ampla: vínculos ilegíveis nunca viram "imóvel sem parceiro". */
const fonte = readFileSync(new URL("./servidor.ts", import.meta.url), "utf8");
function corpo(nome: string): string {
  const i = fonte.indexOf(`export async function ${nome}(`);
  assert.ok(i >= 0, nome);
  return fonte.slice(i, fonte.indexOf("\n}\n", i) + 2);
}

test("vinculosDoImovelAdmin lança na falha de leitura", () => {
  const f = corpo("vinculosDoImovelAdmin");
  assert.match(f, /const \{ data, error \} = await admin\s*\.from\("imovel_parceiros"\)/);
  assert.match(f, /if \(error\) throw new Error\(/);
});

test("aoEventoDaEstadia: o erro cai no aviso à equipe (P2)", () => {
  const f = corpo("aoEventoDaEstadia");
  const leitura = f.indexOf("await vinculosDoImovelAdmin(");
  const captura = f.indexOf("} catch (e) {");
  assert.ok(leitura >= 0 && captura > leitura, "a leitura está dentro do try");
  assert.match(f.slice(captura), /await avisarFalhaAutomacao\(admin, ev\.tipo, contratoId\);/);
});
