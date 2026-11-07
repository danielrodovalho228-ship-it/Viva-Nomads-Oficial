/*
  Erros/estados vazios (rodada 3) — falha de LEITURA não vira "não encontrado / não está mais em andamento":
  enviarProposta e aceitar (candidatura), e responder a pedido (pedido e imóvel) distinguem erro de banco de ausência de linha.
  Roda: node --test src/lib/data/e293-leituras-proposta-pedido.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");

test("propostas: ler a candidatura (enviar e aceitar) separa erro de banco de 'não está mais em andamento'", () => {
  const s = ler("src/lib/data/propostas-actions.ts");
  assert.match(s, /const MSG_CANDIDATURA_SEM_LEITURA = "[^"]+";/);
  assert.match(s, /const \{ data: lead, error: erroLead \} = await s\.admin\.from\("leads"\)\.select\("id, owner_id, tenant_id, property_id, status"\)[^;]*;\s*\n\s*if \(erroLead\) return \{ ok: false, error: MSG_CANDIDATURA_SEM_LEITURA \};/);
  assert.match(s, /const \{ data: lead, error: erroLead \} = await admin\.from\("leads"\)\.select\("id, status"\)[^;]*;\s*\n\s*if \(erroLead\) return \{ ok: false, error: MSG_CANDIDATURA_SEM_LEITURA \};/);
});

test("pedidos: responder a um pedido separa erro de banco de 'pedido indisponível' e de 'selecione um imóvel seu'", () => {
  const s = ler("src/lib/data/pedidos-actions.ts");
  assert.match(s, /const MSG_PEDIDO_SEM_LEITURA = "[^"]+";/);
  assert.match(s, /const \{ data: pedido, error: erroPedido \} = await supabase\s*\.from\("pedidos_publicos"\)[\s\S]{0,160}\.maybeSingle\(\);\s*\n\s*if \(erroPedido\) return \{ ok: false, error: MSG_PEDIDO_SEM_LEITURA \};/);
  assert.match(s, /const \{ data: imovel, error: erroImovel \} = await supabase\s*\.from\("properties"\)[\s\S]{0,160}\.maybeSingle\(\);\s*\n\s*if \(erroImovel\) return \{ ok: false, error: MSG_PEDIDO_SEM_LEITURA \};/);
});
