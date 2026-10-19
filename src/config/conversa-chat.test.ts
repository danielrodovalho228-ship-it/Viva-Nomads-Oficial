import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { FRASE_CONVERSA_CHAT, PASSO_CONVERSE_TEXTO } from "./conversa-chat.ts";

// Ordem b3790661 (D3): um só discurso — conversa pelo chat da Viva; contato direto só depois do aceite.
function arquivos(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return arquivos(p);
    return /\.(tsx?|md)$/.test(n) && !/\.test\.ts$/.test(n) ? [p] : [];
  });
}

const PROIBIDAS = [/fale direto com o propriet/i, /chat com quem vai morar/i, /a conversa é com a viva/i];

test("nenhum texto do site contradiz a regra do chat mascarado até o aceite", () => {
  const achados: string[] = [];
  for (const f of arquivos("src")) {
    const txt = readFileSync(f, "utf8");
    for (const re of PROIBIDAS) if (re.test(txt)) achados.push(`${f}: ${re}`);
  }
  assert.deepEqual(achados, []);
});

test("a frase única fala de chat da Viva e de contato só depois do aceite", () => {
  assert.match(FRASE_CONVERSA_CHAT, /chat da Viva/);
  assert.match(FRASE_CONVERSA_CHAT, /depois do aceite/);
  assert.match(PASSO_CONVERSE_TEXTO, /chat da Viva/);
});

test("home, como funciona, anúncio e preços usam a frase única", () => {
  const le = (p: string) => readFileSync(p, "utf8");
  assert.match(le("src/app/(public)/page.tsx"), /PASSO_CONVERSE_TEXTO/);
  assert.match(le("src/app/(public)/como-funciona/page.tsx"), /PASSO_CONVERSE_TEXTO/);
  assert.match(le("src/app/(public)/imoveis/[id]/property-detail.tsx"), /FRASE_CONVERSA_CHAT/);
});
