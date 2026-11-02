/*
  Frente 1 (estados vazios) — achado 131 (média): a fila "Verificação de identidade — análise de uma pessoa"
  (/admin/documentos) lia as verificações pendentes sem conferir o erro. Na falha, a equipe via "Nenhuma verificação
  esperando análise." com gente parada na fila (a 2ª reprovação automática espera uma pessoa). Agora a falha mostra o
  aviso na própria seção (o resto da página, a fila de documentos, continua de pé) e nunca o "nenhuma".
  Só a leitura muda: decidir continua igual (adminDecidirVerificacao), sem nenhuma regra de identidade nova.
  Roda: node --test src/lib/identidade/achado131-fila-revisao.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const t = readFileSync(new URL("../../components/admin/verificacoes-revisao.tsx", import.meta.url), "utf8");

test("fila de revisão: a falha da leitura avisa; nunca 'nenhuma verificação esperando'", () => {
  assert.match(t, /const \{ data, error: erroFila \} = await admin\.from\("verificacao_revisoes"\)/);
  assert.match(t, /data-testid="verificacao-revisoes-falhou"/);
  const aviso = t.indexOf('data-testid="verificacao-revisoes-falhou"');
  const vazia = t.indexOf("Nenhuma verificação esperando análise.");
  assert.ok(aviso > 0 && aviso < vazia, "o aviso vem antes do estado vazio");
  assert.match(t, /\{erroFila \? \(/);
});
