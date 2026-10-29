/*
  ADMIN-1 — a barra do admin (fonte única em menu-admin.ts).
  Roda: node --test src/config/menu-admin.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { BARRA_ADMIN, FORA_DA_BARRA_ADMIN, PAGINAS_BARRA_ADMIN, rotuloDoAdmin, tituloDoAdmin } from "./menu-admin.ts";
import { menuDoPainel, folhas } from "./menu-painel.ts";

const RAIZ = "src/app/(dashboard)/admin";

/** Toda rota do /admin que tem page.tsx, ex.: "/admin/contratos/[id]". */
function rotasDoAdmin(dir = RAIZ, rota = "/admin"): string[] {
  const out: string[] = [];
  for (const nome of readdirSync(dir)) {
    const p = join(dir, nome);
    if (statSync(p).isDirectory()) out.push(...rotasDoAdmin(p, `${rota}/${nome}`));
    else if (nome === "page.tsx") out.push(rota);
  }
  return out;
}

test("ordem da barra (instantâneo): Visão geral, Pendências e os sete grupos", () => {
  const forma = BARRA_ADMIN.map((i) => (i.filhos ? `${i.rotulo}: ${i.filhos.map((f) => f.rotulo).join(" · ")}` : i.rotulo));
  assert.deepEqual(forma, [
    "Visão geral",
    "Pendências",
    "Anúncios e pessoas: Anúncios · Publicamos para você · Pedidos de moradia · Usuários · Documentos · Fotos de perfil",
    "Estadias: Contratos · Candidaturas · Manutenção · Serviços do morador · Atendimento",
    "Rede: Parceiros · Avaliações do imóvel",
    "Cidades e marketing: Cidades · Destinos · Marketing",
    "Números: Financeiro · Funil e indicadores · Eventos · Qualidade",
    "Equipe: Central de Agentes · Caixa dos Sócios",
    "Sistema: Chaves e integrações · Dados e retenção · Testes",
  ]);
});

test("nenhum href repetido e nenhum rótulo repetido na barra", () => {
  const hrefs = PAGINAS_BARRA_ADMIN.map((i) => i.href);
  assert.equal(new Set(hrefs).size, hrefs.length, hrefs.join(", "));
  const rotulos = PAGINAS_BARRA_ADMIN.map((i) => i.rotulo);
  assert.equal(new Set(rotulos).size, rotulos.length);
});

test("na barra do admin só há rotas do /admin (nada do /dashboard)", () => {
  for (const i of PAGINAS_BARRA_ADMIN) assert.ok(i.href === "/admin" || i.href!.startsWith("/admin/"), i.href);
});

test("Equipe e aprovações, Fotógrafos e E-mails de teste saíram da barra", () => {
  const rotulos = PAGINAS_BARRA_ADMIN.map((i) => i.rotulo);
  for (const r of ["Equipe e aprovações", "Fotógrafos", "E-mails de teste"]) assert.ok(!rotulos.includes(r), r);
  for (const h of ["/admin/fotografos", "/admin/emails-teste"]) assert.ok(h in FORA_DA_BARRA_ADMIN, h);
});

test("toda página do /admin está na barra ou documentada fora dela (com o porquê); nenhuma foi apagada", () => {
  const naBarra = new Set(PAGINAS_BARRA_ADMIN.map((i) => i.href));
  const rotas = rotasDoAdmin();
  for (const r of rotas) assert.ok(naBarra.has(r) || r in FORA_DA_BARRA_ADMIN, `${r} sem lugar na barra nem em FORA_DA_BARRA_ADMIN`);
  for (const [r, porque] of Object.entries(FORA_DA_BARRA_ADMIN)) assert.ok(porque.length > 10, r);
  // Toda página da barra existe.
  for (const h of naBarra) assert.ok(rotas.includes(h!), `${h} na barra sem page.tsx`);
});

test("toda página da barra usa tituloDoAdmin no <title>; o <h1> é o rótulo da barra", () => {
  for (const i of PAGINAS_BARRA_ADMIN) {
    const arq = join(RAIZ, i.href!.replace(/^\/admin/, ""), "page.tsx");
    const fonte = readFileSync(arq, "utf8");
    assert.ok(fonte.includes(`tituloDoAdmin("${i.href}")`), `${arq} sem tituloDoAdmin`);
  }
  assert.equal(tituloDoAdmin("/admin/contratos"), "Contratos — Admin");
  assert.equal(rotuloDoAdmin("/admin/agentes"), "Central de Agentes");
  assert.throws(() => rotuloDoAdmin("/dashboard"));
});

test("no /dashboard o admin vê as áreas de usuário e UM item 'Painel admin'", () => {
  const m = menuDoPainel({ temImovel: true, admin: true, estadiaAtiva: false });
  const fs = folhas(m);
  const admin = fs.filter((i) => i.href === "/admin" || i.href?.startsWith("/admin/"));
  assert.deepEqual(admin.map((i) => i.rotulo), ["Painel admin"]);
});

test("E216: o admin observador da QA não vê 'Caixa dos Sócios' na barra; o admin comum vê", async () => {
  const { barraAdminPara, BARRA_ADMIN, FORA_DA_BARRA_OBSERVADOR } = await import("./menu-admin.ts");
  const folhas = (itens: readonly { href?: string; filhos?: readonly { href?: string }[] }[]) =>
    itens.flatMap((i) => (i.filhos ? i.filhos.map((f) => f.href) : [i.href]));
  assert.equal(barraAdminPara({ observadorQa: false }), BARRA_ADMIN);
  const obs = folhas(barraAdminPara({ observadorQa: true }));
  assert.ok(!obs.includes("/admin/socios"));
  assert.deepEqual(FORA_DA_BARRA_OBSERVADOR, ["/admin/socios"]);
  // Só a Caixa sai: o resto da barra é igual (o grupo Equipe continua, com a Central de Agentes).
  assert.deepEqual(obs, folhas(BARRA_ADMIN).filter((h) => h !== "/admin/socios"));
  const equipe = barraAdminPara({ observadorQa: true }).find((g) => g.id === "admin-equipe");
  assert.deepEqual(equipe?.filhos?.map((f) => f.href), ["/admin/agentes"]);
  // A barra original não é alterada.
  assert.ok(folhas(BARRA_ADMIN).includes("/admin/socios"));
});

test("E216: a casca monta a barra do admin com a marca do observador (vinda do servidor, com os números do menu)", async () => {
  const { readFileSync } = await import("node:fs");
  const casca = readFileSync(new URL("../components/layout/dashboard-shell.tsx", import.meta.url), "utf8");
  assert.match(casca, /barraAdminPara\(\{ observadorQa: contadores\.observadorQa \}\)/);
  assert.doesNotMatch(casca, /\[\.\.\.BARRA_ADMIN\]/);
  const servidor = readFileSync(new URL("../lib/painel/contadores-servidor.ts", import.meta.url), "utf8");
  assert.match(servidor, /admin \? ehObservadorQa\(user\.id\)/);
});
