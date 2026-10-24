/*
  L-31 — a página do imóvel (/imoveis/[id], revalidate = 60) respondia HTTP 500: o selo do LinkedIn (63-B) lia
  `cookies()` (linkedinAtivo) durante a renderização em cache, e o Next aborta a página (DYNAMIC_SERVER_USAGE) mesmo com
  o try/catch. GUARDA: no caminho das páginas públicas com cache, a chave do selo nunca lê cookie.
  Roda: node --test src/lib/linkedin/chave-publica.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");

test("linkedinAtivoPublico não lê cookie (só a chave do servidor e o LinkedIn simulado do laboratório)", () => {
  const chave = ler("./chave.ts");
  const corpo = chave.slice(chave.indexOf("export function linkedinAtivoPublico"));
  assert.ok(corpo.length > 0, "linkedinAtivoPublico existe");
  assert.doesNotMatch(corpo.slice(0, corpo.indexOf("\n}\n") + 2), /cookies\(|await /);
});

test("linkedinConectados com { publico: true } usa a chave sem cookie", () => {
  assert.match(ler("./servidor.ts"), /opcoes\.publico \? linkedinAtivoPublico\(\) : await linkedinAtivo\(\)/);
});

test("as páginas públicas com cache (imóvel e proprietário) só pedem o selo pela chave sem cookie", () => {
  for (const f of ["../data/perfil-proprietario.ts", "../data/avaliacoes-autores.ts"]) {
    const s = ler(f);
    const chamadas = s.split("\n").filter((l) => l.includes("linkedinConectados(") && !/^\s*import /.test(l));
    assert.ok(chamadas.length > 0, f);
    for (const c of chamadas) assert.match(c, /publico: true/, `${f}: ${c}`);
    assert.doesNotMatch(s, /linkedinAtivo\(|vistoriaAtiva\(|cookies\(\)/, f);
  }
  // As duas páginas seguem com cache (o conserto não pode ser "virar dinâmica").
  assert.match(ler("../../app/(public)/imoveis/[id]/page.tsx"), /export const revalidate = 60;/);
});
