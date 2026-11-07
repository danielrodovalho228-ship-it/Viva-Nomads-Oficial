/*
  Achado 171 — admin mudando o estado de um pedido de serviço e reclassificando a prioridade de uma solicitação de
  manutenção: a leitura não olhava o erro; com o banco falhando lia "Pedido não encontrado." / "Solicitação não encontrada.".
  Roda: node --test src/lib/data/achado171-servicos-reclassificar-leitura.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const serv = readFileSync(new URL("./servicos-morador-actions.ts", import.meta.url), "utf8");
const manu = readFileSync(new URL("./manutencao-actions.ts", import.meta.url), "utf8");

test("pedido de serviço: destrincha o erro antes de 'Pedido não encontrado'", () => {
  assert.match(serv, /const \{ data: atual, error: erroLeitura \} = await admin\.from\("servicos_pedidos"\)/);
  assert.match(serv, /if \(erroLeitura\) return \{ ok: false, error: "Não foi possível ler o pedido agora\. Tente de novo\." \};\n\s*if \(!atual\) return \{ ok: false, error: "Pedido não encontrado\." \};/);
});

test("reclassificar: destrincha o erro antes de 'Solicitação não encontrada'", () => {
  assert.match(manu, /const \{ data: o, error: erroOrdem \} = await admin\.from\("service_orders"\)\.select\("priority, prioridade_original, owner_id"\)/);
  assert.match(manu, /if \(erroOrdem\) return \{ ok: false, error: "Não foi possível ler a solicitação agora\. Tente de novo\." \};\n\s*if \(!o\) return \{ ok: false, error: "Solicitação não encontrada\." \};/);
});
