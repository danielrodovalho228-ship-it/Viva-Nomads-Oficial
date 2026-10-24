/*
  E101-DETECCAO-A — fonte única da localização, detecção montada no nível e espelho pelo papel ativo.
  Roda: node --test src/lib/e101.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { TITULO_ESPELHO, TITULO_ESPELHO_DONO, verComo } from "./perfil/espelho.ts";

const ler = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("localização: todo lugar que mostra bairro e cidade usa linhaLocalizacao (página, cartões, mapa, comparar, OG, metadados, e-mail)", () => {
  for (const f of [
    "app/(public)/imoveis/[id]/property-detail.tsx",
    "components/property-card.tsx",
    "components/property-mini-card.tsx",
    "components/busca/card-pin-mapa.tsx",
    "app/(public)/comparar/page.tsx",
    "app/(dashboard)/dashboard/comparar/page.tsx",
    "app/(public)/imoveis/[id]/opengraph-image.tsx",
    "lib/anuncio/metadados-imovel.ts",
    "lib/busca/alerta-busca.ts",
    "lib/anuncio/assistente-telas.ts",
  ]) {
    const s = ler(f);
    assert.match(s, /linhaLocalizacao\(/, f);
    assert.doesNotMatch(s, /\{property\.city\} - \{property\.state\}|\$\{p\.neighborhood\}, \$\{p\.city\}/, f);
  }
  // JSON-LD: sem UF, nada de addressRegion vazio.
  assert.match(ler("lib/seo/anuncio-cidade.ts"), /\.\.\.\(p\.state\?\.trim\(\) \? \{ addressRegion: p\.state\.trim\(\)\.toUpperCase\(\) \} : \{\}\)/);
});

test("e-mail do alerta: o bairro vem da coluna `address` (a tabela não tem `neighborhood`) e a UF entra na linha", () => {
  const f = ler("lib/data/alerta-busca-servidor.ts");
  const select = f.match(/from\("properties"\)\s*\.select\("([^"]+)"\)/)?.[1] ?? "";
  const colunas = select.split(",").map((c) => c.trim());
  assert.ok(colunas.includes("address") && colunas.includes("state"), select);
  assert.ok(!colunas.includes("neighborhood"), "a coluna neighborhood não existe em properties");
  assert.match(f, /neighborhood: \(r\.address as string\)/);
});

test("detecção na edição: as sugestões ficam na página do nível, acima dos itens de prova; comodidade grava na hora", () => {
  const pagina = ler("app/(dashboard)/dashboard/imoveis/[id]/nivel/page.tsx");
  assert.ok(pagina.indexOf("<SugestoesNoNivel") > 0 && pagina.indexOf("<SugestoesNoNivel") < pagina.indexOf("<FormNivel"));
  const wrapper = ler("app/(dashboard)/dashboard/imoveis/[id]/nivel/sugestoes-no-nivel.tsx");
  assert.match(wrapper, /<SugestoesDasFotos/);
  assert.match(wrapper, /void gravarComodidadeConfirmada\(propertyId, chave\)/);
  // FOTO-NA-HORA: item de nível é a câmera do item, nunca "Usar esta foto".
  const comp = ler("components/niveis/sugestoes-fotos.tsx");
  assert.match(comp, /<ProvaNaHora/);
  assert.doesNotMatch(comp, /Usar esta foto/);
  const acao = ler("lib/data/comodidade-sugerida-actions.ts");
  assert.match(acao, /owner_id === user\.id/, "só no imóvel do dono");
  assert.match(acao, /const label = AMENITY_LABEL\[chave\];[\s\S]*if \(!supabase \|\| !label\) return \{ ok: false \};/, "só chave do catálogo");
});

test("E55: o espelho segue o papel em uso; quem tem os dois papéis vê 'Ver como …'", () => {
  assert.equal(TITULO_ESPELHO, "É assim que o proprietário te vê quando você pede para morar");
  assert.equal(TITULO_ESPELHO_DONO, "É assim que o morador te vê no seu anúncio");
  assert.equal(verComo("morador"), "Ver como morador");
  assert.equal(verComo("proprietario"), "Ver como proprietário");
  const tela = ler("components/account/perfil-tela.tsx");
  assert.match(tela, /const papelEspelho = mode === "owner" \? "proprietario" : "morador";/);
  assert.equal((tela.match(/<EspelhoPorPapel papel=\{papelEspelho\}/g) ?? []).length, 2);
  const espelho = ler("components/account/espelho-papel.tsx");
  assert.match(espelho, /const papel: Papel = !ehDono \? "morador" : \(visto \?\? p\.papel\);/);
  assert.match(espelho, /\{ehDono && \(/);
  for (const t of ["espelho-desde", "espelho-resposta", "espelho-selos"]) assert.match(espelho, new RegExp(`data-testid="${t}"`));
});
