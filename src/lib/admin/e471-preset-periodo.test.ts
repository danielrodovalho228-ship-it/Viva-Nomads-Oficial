/*
  E471 (AD2) — Financeiro do admin: clicar "7 dias" mudava a URL para ?periodo=7, mas o destaque seguia em "30 dias",
  as datas seguiam 04/10–02/11/2026 e o rótulo "(30 dias)": o operador lia números de 30 dias achando que eram de 7.
  Reproduzido em dev: as datas De/Até do filtro ficavam presas no período da primeira carga (estado do componente que
  não acompanhava o período aplicado). Correção: (1) os presets e o filtro de cidade/datas fazem navegação COMPLETA
  (a página inteira é renderizada de novo pelo servidor com o período da URL: destaque, datas, rótulo e números saem
  da MESMA leitura, sem cache de navegação do cliente); (2) as datas De/Até seguem o período aplicado.
  Roda: node --test src/lib/admin/e471-preset-periodo.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolverPeriodo } from "./visao-geral.ts";
import { urlFiltrosAdmin } from "./filtros-url.ts";

const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

test("o preset de 7 dias resolve 7 dias, com as datas e o rótulo do mesmo período", () => {
  const p = resolverPeriodo({ periodo: "7" }, "2026-11-02");
  assert.deepEqual({ id: p.id, inicio: p.inicio, fim: p.fim, dias: p.dias }, { id: "7", inicio: "2026-10-27", fim: "2026-11-02", dias: 7 });
  const t = resolverPeriodo({ periodo: "30" }, "2026-11-02");
  assert.deepEqual({ inicio: t.inicio, fim: t.fim, dias: t.dias }, { inicio: "2026-10-04", fim: "2026-11-02", dias: 30 });
});

test("a URL do preset troca o período, larga as datas do personalizado e mantém cidade e recorte", () => {
  const atual = resolverPeriodo({ periodo: "custom", de: "2026-09-01", ate: "2026-09-30" }, "2026-11-02");
  assert.equal(
    urlFiltrosAdmin("/admin/financeiro", atual, "Uberlândia", { tipo: "teste" }, { periodo: "7", de: null, ate: null }),
    "/admin/financeiro?periodo=7&cidade=Uberl%C3%A2ndia&tipo=teste",
  );
  assert.equal(urlFiltrosAdmin("/admin/financeiro", resolverPeriodo({}, "2026-11-02"), null, { tipo: null }, { periodo: "90", de: null, ate: null }), "/admin/financeiro?periodo=90");
  assert.equal(
    urlFiltrosAdmin("/admin", resolverPeriodo({ periodo: "7" }, "2026-11-02"), null, undefined, { periodo: "custom", de: "2026-10-01", ate: "2026-10-10" }),
    "/admin?periodo=custom&de=2026-10-01&ate=2026-10-10",
  );
});

test("filtros: presets em navegação completa; datas seguem o período aplicado", () => {
  const f = ler("components/admin/filtros.tsx");
  assert.doesNotMatch(f, /import Link from "next\/link"/, "preset não usa navegação do cliente");
  assert.doesNotMatch(f, /router\.push/);
  assert.match(f, /<a\s+key=\{p\.id\}\s+href=\{url\(\{ periodo: p\.id, de: null, ate: null \}\)\}/);
  assert.match(f, /window\.location\.assign\(url\(\{ periodo: "custom", de, ate \}\)\)/);
  assert.match(f, /window\.location\.assign\(url\(\{ cidade: e\.target\.value \|\| null \}\)\)/);
  assert.match(f, /if \(visto !== aplicado\) \{\s*setVisto\(aplicado\);\s*setDe\(periodo\.inicio\);\s*setAte\(periodo\.fim\);\s*\}/);
  assert.match(f, /data-testid="filtro-periodo-preset"/);
});
