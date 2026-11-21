/*
  Auditoria de erros e estados vazios, achado nº 176 (galeria do parceiro): a falha de LEITURA da foto não pode virar
  "Foto não encontrada" — o parceiro concluiria que a foto já não existe, quando só não foi possível ler. A ação lê o erro e
  responde "Não foi possível ler a foto agora." antes de remover qualquer coisa.
  Roda: node --test src/lib/parceiros/achado176-leitura-galeria.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const fonte = readFileSync(new URL("./painel-actions.ts", import.meta.url), "utf8");
const fn = fonte.slice(fonte.indexOf("export async function removerFotoGaleria"), fonte.indexOf("/** Troca a foto de lugar"));

test("176: removerFotoGaleria — falha ao ler a foto não vira 'Foto não encontrada' e nada é removido", () => {
  assert.match(fn, /const \{ data: f, error: erroFoto \}/);
  const iErro = fn.indexOf("if (erroFoto)");
  assert.ok(iErro > 0, "confere o erro de leitura");
  assert.match(fn, /if \(erroFoto\) return \{ ok: false, erro: "Não foi possível ler a foto agora\. Tente de novo\." \};/);
  assert.ok(iErro < fn.indexOf("if (!f)"), "o erro vem antes do 'não encontrada'");
  assert.ok(iErro < fn.indexOf(".delete()"), "e antes de apagar");
});
