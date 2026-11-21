/*
  Achado 163 — admin de parcerias: conferir, aprovar e recusar pedido de parceria (e a decisão do selo da nota) liam o pedido
  sem olhar o erro: com o banco falhando o atendimento lia "Pedido não encontrado." / "Parceiro não encontrado." e achava
  que o pedido tinha sumido. Agora a falha de leitura tem frase própria.
  Roda: node --test src/lib/parceiros/achado163-admin-pedidos-leitura.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("./admin-actions.ts", import.meta.url), "utf8");

test("as 3 leituras do pedido destrinchem o erro e dizem a frase própria ANTES de 'Pedido não encontrado'", () => {
  const leituras = [...src.matchAll(/const \{ data: sol, error: erroSol \} = await a\.admin\.from\("parceiro_solicitacoes"\)/g)];
  assert.equal(leituras.length, 4);
  const falhas = [...src.matchAll(/if \(erroSol\) return \{ ok: false, erro: "Não foi possível ler o pedido agora\. Tente de novo\." \};\n\s*if \(!sol\) return \{ ok: false, erro: "Pedido não encontrado\." \};/g)];
  assert.equal(falhas.length, 3);
  // Reenviar ativação: a falha de leitura não vira "só pedidos aprovados recebem um novo link".
  assert.match(src, /if \(erroSol\) return \{ ok: false, erro: "Não foi possível ler o pedido agora\. Tente de novo\." \};\n\s*if \(!sol \|\| sol\.status !== "aprovada"/);
});

test("a decisão do selo da nota diz a falha de leitura do parceiro antes de 'Parceiro não encontrado'", () => {
  assert.match(src, /const \{ data: p, error: erroParceiro \} = await a\.admin\.from\("parceiros"\)\.select\("id, user_id, tipo_pessoa, emite_nota, nota_selo_removido_em"\)/);
  assert.match(src, /if \(erroParceiro\) return \{ ok: false, erro: "Não foi possível ler o parceiro agora\. Tente de novo\." \};\n\s*if \(!p\) return \{ ok: false, erro: "Parceiro não encontrado\." \};/);
});
