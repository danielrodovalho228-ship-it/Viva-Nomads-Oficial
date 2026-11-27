/*
  E700: o checklist de publicação (Passo 10 e /dashboard/imoveis) refletia declarações que nunca chegavam ao servidor.
  Causa: o autosave do rascunho espera 2 s (debounce) e a limpeza do efeito CANCELAVA o salvamento pendente; quem mexia
  numa declaração e saía da página antes disso perdia a mudança, e a lista de imóveis (que lê o rascunho gravado) seguia
  com o checklist velho. Agora o salvamento pendente de uma EDIÇÃO real é gravado quando a página sai.
  Roda: node --test "src/app/(dashboard)/dashboard/imoveis/novo/e700-autosave-ao-sair.test.ts"
*/
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const src = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");

test("o salvamento pendente de uma edição fica guardado e é gravado quando a página sai", () => {
  assert.match(src, /const gravacaoPendenteRef = useRef<\(\(\) => Parameters<typeof saveDraftData>\[0\]\) \| null>\(null\);/);
  // sai da página => grava o que estava pendente (uma vez), sem esperar os 2 s
  assert.match(src, /useEffect\(\(\) => \(\) => \{\s*const montar = gravacaoPendenteRef\.current;\s*if \(!montar\) return;\s*gravacaoPendenteRef\.current = null;\s*void saveDraftData\(montar\(\)\)\.catch\(\(\) => \{\}\);\s*\}, \[\]\);/);
});

test("só uma edição real fica pendente; ao disparar o salvamento normal, a pendência é limpa (sem gravar duas vezes)", () => {
  const i = src.indexOf("const conteudo = conteudoDoRascunho(draftJson);");
  const efeito = src.slice(i, i + 4200);
  assert.match(efeito, /gravacaoPendenteRef\.current = decisao === "edicao" \? montarGravacao : null;/);
  assert.match(efeito, /const t = setTimeout\(async \(\) => \{\s*gravacaoPendenteRef\.current = null;/);
});
