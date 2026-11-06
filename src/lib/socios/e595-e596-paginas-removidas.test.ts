/* Roda: node --test src/lib/socios/e595-e596-paginas-removidas.test.ts
  E595/E596 parte (a) — ordem do Daniel, 05/11: /decisao (modelo REVOGADO: assinatura + Gestor a 0%, "3 sócios") e
  /socios (sócios errados e desenho revogado) saem por completo. Acesso direto à URL redireciona para a área interna
  válida (/modelodenegocio, que segue atrás da porta dos sócios) — nunca mostra o conteúdo velho. Os capítulos "Sócios" e
  "Decisão" saem do menu do documento interno; "Modelo de negócio", "Simulação" e "ROI" ficam; /admin/socios não muda.
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { INTERNAL_PAGES, sanitizeNext } from "./access.ts";

const raiz = (p: string) => new URL(`../../../${p}`, import.meta.url);
const ler = (p: string) => readFileSync(raiz(p), "utf8");

test("E595/E596: as páginas e os componentes de /socios e /decisao não existem mais", () => {
  for (const p of ["src/app/socios/page.tsx", "src/app/decisao/page.tsx", "src/components/socios/socios.tsx", "src/components/decisao/decisao.tsx"]) {
    assert.equal(existsSync(raiz(p)), false, p);
  }
  // /admin/socios (Caixa dos Sócios) fica.
  assert.equal(existsSync(raiz("src/app/(dashboard)/admin/socios")), true);
});

test("E595/E596: acesso direto (e subcaminhos) redireciona para /modelodenegocio, temporário", () => {
  const cfg = ler("next.config.ts");
  for (const origem of ["/socios", "/socios/:path*", "/decisao", "/decisao/:path*"]) {
    assert.match(cfg, new RegExp(`source: "${origem.replace(/[/*:]/g, (c) => "\\" + c)}", destination: "/modelodenegocio", permanent: false`), origem);
  }
});

test("E595/E596: o menu do documento interno fica com Modelo de negócio, Simulação e ROI", () => {
  const nav = ler("src/components/apresentacao/paginas-nav.tsx");
  assert.doesNotMatch(nav, /href: "\/socios"|href: "\/decisao"|nome: "Sócios"|nome: "Decisão"/);
  for (const h of ["/modelodenegocio", "/simulacao", "/roi"]) assert.match(nav, new RegExp(`href: "${h}"`), h);
});

test("E595/E596: a porta dos sócios não lista nem manda mais para /socios ou /decisao", () => {
  assert.ok(!INTERNAL_PAGES.includes("/socios" as never) && !INTERNAL_PAGES.includes("/decisao" as never));
  assert.equal(sanitizeNext(null), "/modelodenegocio");
  assert.equal(sanitizeNext("/socios"), "/modelodenegocio");
  assert.equal(sanitizeNext("/simulacao"), "/simulacao");
  const proxy = ler("src/proxy.ts");
  assert.doesNotMatch(proxy, /"\/socios"|"\/decisao"|"\/socios\/:path\*"|"\/decisao\/:path\*"/);
});
