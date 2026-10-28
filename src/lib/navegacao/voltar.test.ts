/* E69 — voltar das subtelas no celular. Roda: node --test src/lib/navegacao/voltar.test.ts */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { veioDeDentroDoSite } from "./voltar.ts";

const O = "https://www.vivanomads.com.br";

test("volta pelo histórico só quando a pessoa veio de outra tela do site", () => {
  assert.equal(veioDeDentroDoSite("", O, 3, true), true, "navegação interna marcada");
  assert.equal(veioDeDentroDoSite(`${O}/dashboard`, O, 2, false), true, "referrer do próprio site");
  assert.equal(veioDeDentroDoSite("https://mail.google.com/", O, 2, false), false, "veio de fora: destino padrão");
  assert.equal(veioDeDentroDoSite("", O, 1, true), false, "aba nova sem histórico: destino padrão");
  assert.equal(veioDeDentroDoSite(`${O}.golpe.com/x`, O, 2, false), false, "domínio parecido não conta");
});

test("todas as subtelas da Conta e a Verificação usam o mesmo voltar do celular", () => {
  const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");
  assert.match(ler("src/components/account/casca-conta.tsx"), /<VoltarCelular/);
  assert.match(ler("src/app/(dashboard)/dashboard/verificacao/page.tsx"), /<VoltarCelular padrao="\/dashboard\/conta"/);
  assert.match(ler("src/components/layout/dashboard-shell.tsx"), /<MarcaNavInterna \/>/);
});

test("E69 + E176: o voltar padrão é a Conta; a subtela (Sair da Viva) tem '← Privacidade' no topo", async () => {
  const { readFileSync } = await import("node:fs");
  const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
  const casca = ler("components/account/casca-conta.tsx");
  assert.match(casca, /\{!subtela && <VoltarCelular padrao="\/dashboard\/conta" rotulo="Conta"/);
  assert.match(casca, /\{subtela && <VoltarLista href=\{atual\.href\} rotulo=\{atual\.rotulo\} \/>\}/);
  // Segurança e verificações virou item próprio da Conta (E176 parte 2).
  assert.match(ler("app/(dashboard)/dashboard/conta/seguranca/page.tsx"), /<CascaConta ativo="seguranca" /);
  assert.match(ler("app/(dashboard)/dashboard/conta/excluir/page.tsx"), /<CascaConta ativo="privacidade" subtela /);
  assert.doesNotMatch(ler("app/(dashboard)/dashboard/conta/[secao]/page.tsx"), /<CascaConta[^>]*\bsubtela\b/);
});
