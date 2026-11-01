/*
  Achado nº 26 (erros/estados vazios) — Admin → Imóveis. A lista do banco virava "nenhum imóvel" na falha, e a fila de
  links de vídeo sumia (ou, falhando só as decisões, links já decididos voltavam como pendentes). Agora a lista lança
  (limite de erro do /admin, com "Tentar de novo") e a fila de vídeo lança e vira aviso na página.
  Roda: node --test src/lib/data/achado26-admin-imoveis.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");

test("imoveisDoBanco lança na falha; o /admin tem limite de erro com 'Tentar de novo'", () => {
  const f = ler("src/lib/data/admin-indicadores.ts");
  const i = f.indexOf("export async function imoveisDoBanco(");
  assert.match(f.slice(i, i + 900), /if \(error\) throw new Error\("Não foi possível ler os imóveis agora\."\)/);
  assert.match(ler("src/app/(dashboard)/admin/error.tsx"), /Tentar de novo/);
});

test("a fila de links de vídeo lança na falha das duas leituras e a página avisa", () => {
  const v = ler("src/lib/data/video-link-actions.ts");
  assert.match(v, /if \(erroProps\) throw new Error\(MSG_LINKS_VIDEO_FALHOU\);/);
  assert.match(v, /if \(erroDecisoes\) throw new Error\(MSG_LINKS_VIDEO_FALHOU\);/);
  const pg = ler("src/app/(dashboard)/admin/imoveis/page.tsx");
  assert.doesNotMatch(pg, /listarLinksDeVideoPendentes\(\)\.catch\(\(\) => \[\]\)/);
  assert.match(pg, /listarLinksDeVideoPendentes\(\)\.catch\(\(\) => null\)/);
  assert.match(pg, /const linksFalharam = linksLidos === null;/);
  assert.match(pg, /data-testid="links-video-erro"/);
});
