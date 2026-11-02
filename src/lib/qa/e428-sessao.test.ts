/*
  E428 — "a sessão troca de conta sozinha / ejeta o dono". Investigado antes de corrigir:
   - TROCA DE CONTA: artefato do navegador compartilhado da QA. O registro da porta (qa_entradas, produção, 01/11
     18h41–19h07 BRT) mostra entradas alternadas no MESMO IP entre "Daniel Proprietario 1" e "Conta de teste QA" (admin
     observador) a cada 2–3 min. Os cookies valem para todas as abas: entrar numa conta troca a das outras abas. Nenhum
     caminho do produto entra sozinho como outra conta (a porta só cria sessão com POST + chave). Orientação no
     docs/qa-login.md (um perfil de navegador por conta).
   - QUEDA PARA /auth: causa do produto. O proxy renova o token no getUser() e grava os cookies novos em `response`;
     os 404 por rewrite (admin para não-admin, área de QA, contrato inexistente) e o redirecionamento para /auth saíam
     SEM esses cookies. O navegador ficava com o refresh token já gasto, e a renovação seguinte derrubava a sessão.
     Agora toda resposta que não é `response` passa por comCookies.
  Roda: node --test src/lib/qa/e428-sessao.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");
const proxy = ler("src/proxy.ts");
const depoisDoCliente = proxy.slice(proxy.indexOf("const comCookies = (r: NextResponse) =>"));

test("proxy: todo redirect/rewrite depois do getUser leva os cookies renovados (comCookies)", () => {
  assert.ok(depoisDoCliente.length > 0, "comCookies existe");
  const respostas = depoisDoCliente.match(/NextResponse\.(redirect|rewrite)\(/g) ?? [];
  const embrulhadas = depoisDoCliente.match(/comCookies\(NextResponse\.(redirect|rewrite)\(/g) ?? [];
  assert.ok(respostas.length >= 7, `${respostas.length} respostas`);
  assert.equal(embrulhadas.length, respostas.length, "alguma resposta saiu sem os cookies renovados");
  // Os três 404 por rewrite que perdiam a sessão.
  assert.equal(depoisDoCliente.match(/comCookies\(NextResponse\.rewrite\(\w+, \{ status: 404 \}\)\)/g)?.length, 3);
});

test("porta de QA: só entra com POST + chave (nada troca de conta sozinho) e o guia avisa da sessão por navegador", () => {
  const rota = ler("src/app/api/qa/entrar/route.ts");
  assert.match(rota, /export function GET\(\) \{\s*registrarRecusaQa\("metodo"\);\s*return naoEncontrado\(\);/);
  assert.match(ler("src/lib/qa/entrar-servidor.ts"), /const chaveOk = chaveConfere\(entrada\.chave, hash\);/);
  assert.match(ler("docs/qa-login.md"), /Uma sessão por navegador \(E428\)/);
});
