/*
  Achado 166 — atendimento (admin): responder ao chamado, mudar prioridade/estado, corrigir a resposta da IA e pedir o
  rascunho por regra liam o chamado/mensagem sem olhar o erro: com o banco falhando o atendente lia "Chamado não
  encontrado." / "Resposta não encontrada." e achava que o chamado tinha sumido. Agora a falha de leitura tem frase própria.
  Roda: node --test src/lib/data/achado166-atendimento-admin-leitura.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("./atendimento-actions.ts", import.meta.url), "utf8");

test("responder e atualizar chamado: leitura do chamado destrincha o erro antes de 'Chamado não encontrado'", () => {
  const leituras = [...src.matchAll(/const \{ data: c, error: erroChamado \} = await ctx\.admin\s*\.from\("chamados"\)/g)];
  assert.equal(leituras.length, 2);
  const frases = [...src.matchAll(/if \(erroChamado\) return \{ ok: false, error: "Não foi possível ler o chamado agora\. Tente de novo\." \};\n\s*if \(!c\) return \{ ok: false, error: "Chamado não encontrado\." \};/g)];
  assert.equal(frases.length, 2);
});

test("resposta da IA e rascunho por regra também destrincham o erro", () => {
  assert.match(src, /const \{ data: m, error: erroMsg \} = await ctx\.admin\.from\("chamado_mensagens"\)\.select\("id"\)/);
  assert.match(src, /if \(erroMsg\) return \{ ok: false, error: "Não foi possível ler a resposta agora\. Tente de novo\." \};\n\s*if \(!m\) return \{ ok: false, error: "Resposta não encontrada\." \};/);
  assert.match(src, /const \{ data: c, error: erroRegra \} = await ctx\.admin\.from\("chamados"\)\.select\("usuario_id, visitante_nome"\)/);
  assert.match(src, /if \(erroRegra\) return \{ ok: false, error: "Não foi possível ler o chamado agora\. Tente de novo\." \};\n\s*if \(!c\) return \{ ok: false, error: "Chamado não encontrado\." \};/);
});
