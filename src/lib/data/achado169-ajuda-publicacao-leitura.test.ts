/*
  Achado 169 — pedido de ajuda para publicar: mudar a etapa (equipe) e aprovar/pedir ajuste (dono) liam o pedido sem
  olhar o erro: com o banco falhando a pessoa lia "Pedido não encontrado." e achava que o pedido tinha sumido.
  Roda: node --test src/lib/data/achado169-ajuda-publicacao-leitura.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("./ajuda-publicacao-actions.ts", import.meta.url), "utf8");

test("equipe e dono: a leitura do pedido destrincha o erro antes de 'Pedido não encontrado'", () => {
  const leituras = [...src.matchAll(/const \{ data: atual, error: erroLeitura \} = await supabase/g)];
  assert.equal(leituras.length, 2);
  const frases = [...src.matchAll(/if \(erroLeitura\) return \{ ok: false, error: "Não foi possível ler o pedido agora\. Tente de novo\." \};\n\s*if \(!atual \|\| !ehStatusAjuda\(atual\.status\)\) return \{ ok: false, error: "Pedido não encontrado\." \};/g)];
  assert.equal(frases.length, 2);
});
