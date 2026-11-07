/*
  E654 — "Enviar código por e-mail" girava e voltava sem confirmação nem erro: a tela só tratava o retorno {ok:false}; uma
  exceção da ação (ou a chamada ao servidor falhar) saía sem mensagem. Agora: a ação nunca lança (qualquer falha vira
  {ok:false, error} e é registrada com a causa) e a tela mostra o erro OU a confirmação do envio, sempre.
  Roda: node --test src/lib/data/e654-codigo-assinatura-visivel.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

test("a ação pedirCodigoAssinatura nunca lança: captura, registra a causa e devolve erro visível", () => {
  const src = ler("lib/data/contrato-assinar-actions.ts");
  assert.match(src, /export async function pedirCodigoAssinatura\(contratoId: string\): Promise<\{ ok: boolean; error\?: string \}> \{\s*try \{\s*return await pedirCodigoAssinaturaInterno\(contratoId\);\s*\} catch \(e\) \{/);
  assert.match(src, /console\.error\("\[assinatura\] pedir código falhou:"/);
  assert.match(src, /async function pedirCodigoAssinaturaInterno\(/);
});

test("a tela mostra o erro quando a chamada falha e a confirmação quando envia", () => {
  const src = ler("components/contrato/assinar-contrato.tsx");
  const pedir = src.slice(src.indexOf("async function pedir()"), src.indexOf("async function assinar("));
  assert.match(pedir, /catch/);
  assert.match(pedir, /setErro\(/);
  assert.match(src, /data-testid="assinar-codigo-enviado"/);
});
