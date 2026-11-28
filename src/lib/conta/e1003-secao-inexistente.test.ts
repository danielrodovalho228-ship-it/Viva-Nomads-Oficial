/*
  E1003 (Gerente, ronda 20:04 de 16/11/2026) — a seção inexistente da Conta responde o 404 do resto do site.
  Antes: /dashboard/conta/<qualquer coisa> respondia 200 com a tela "Página não encontrada" do painel, porque a página
  só descobria que a seção não existe depois de a resposta ter começado. O resto do painel (/dashboard/<qualquer coisa>)
  responde 404. A conferência passa para o proxy, antes de a página desenhar, no mesmo padrão do 404 do admin.
  Roda: node --test src/lib/conta/e1003-secao-inexistente.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { secaoDaContaInexistente } from "./redirecionar-no-servidor.ts";

const RAIZ = new URL("../../../", import.meta.url).pathname;
const ler = (p: string) => readFileSync(join(RAIZ, p), "utf8");
const PASTA_DA_CONTA = "src/app/(dashboard)/dashboard/conta";

test("seção que não existe: verdadeiro", () => {
  for (const p of ["/dashboard/conta/nao-existe", "/dashboard/conta/Perfil", "/dashboard/conta/perfil2", "/dashboard/conta/admin", "/dashboard/conta/nao-existe/", "/dashboard/conta/%00"])
    assert.equal(secaoDaContaInexistente(p), true, p);
});

test("toda seção, endereço antigo e subtela que existe: falso", () => {
  for (const s of ["perfil", "papeis", "dados", "privacidade", "seguranca", "notificacoes", "pagamentos", "ajuda", "avaliacoes", "excluir", "plano", "perfil-publico"])
    assert.equal(secaoDaContaInexistente(`/dashboard/conta/${s}`), false, s);
  assert.equal(secaoDaContaInexistente("/dashboard/conta/dados/"), false, "barra no fim");
});

test("fora de /dashboard/conta/<uma parte>: a regra não se mete", () => {
  for (const p of ["/dashboard/conta", "/dashboard/conta/", "/dashboard", "/dashboard/contas/x", "/dashboard/conta-x/y", "/dashboard/conta/dados/extra", "/dashboard/imoveis/nao-existe", "/conta/nao-existe", "/"])
    assert.equal(secaoDaContaInexistente(p), false, p);
});

test("a lista do proxy cobre tudo o que a pasta e a página da Conta atendem (nenhuma tela real vira 404)", () => {
  // Rotas com pasta própria (avaliacoes, excluir, seguranca…).
  const pastas = readdirSync(join(RAIZ, PASTA_DA_CONTA)).filter((n) => !n.startsWith("[") && statSync(join(RAIZ, PASTA_DA_CONTA, n)).isDirectory());
  assert.ok(pastas.length >= 3, "a Conta tem rotas com pasta própria");
  for (const p of pastas) assert.equal(secaoDaContaInexistente(`/dashboard/conta/${p}`), false, `pasta ${p}`);
  // Seções que a página [secao] atende (cada "case" do switch) e a subtela conferida antes dele.
  const pagina = ler(`${PASTA_DA_CONTA}/[secao]/page.tsx`);
  const casos = [...pagina.matchAll(/case "([a-z-]+)":/g)].map((m) => m[1]);
  assert.ok(casos.length >= 6, "a página atende as seções pelo switch");
  for (const c of casos) assert.equal(secaoDaContaInexistente(`/dashboard/conta/${c}`), false, `case ${c}`);
  for (const m of pagina.matchAll(/bruta === "([a-z-]+)"/g)) assert.equal(secaoDaContaInexistente(`/dashboard/conta/${m[1]}`), false, `subtela ${m[1]}`);
  // A página continua com o seu próprio notFound() (a navegação dentro do site não passa por um pedido de documento).
  assert.match(pagina, /default:\s*notFound\(\);/);
});

test("o proxy responde 404 só para quem está logado, depois do portão do login, com os cookies renovados", () => {
  const proxy = ler("src/proxy.ts");
  const portao = proxy.indexOf("if (isProtected && !user) {");
  const regra = proxy.indexOf("if (user && secaoDaContaInexistente(pathname)) {");
  assert.ok(portao > 0 && regra > portao, "a regra vem depois do portão do login: sem sessão, o caminho continua sendo o login");
  const bloco = proxy.slice(regra, proxy.indexOf("\n  }\n", regra));
  assert.match(bloco, /return comCookies\(NextResponse\.rewrite\(\w+, \{ status: 404 \}\)\);/, "404 pelo mesmo padrão do admin, com os cookies renovados (E428)");
  assert.doesNotMatch(bloco, /redirect\(/);
});
