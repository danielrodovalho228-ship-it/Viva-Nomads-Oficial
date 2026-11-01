import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");

test("achado 40: /admin/sistema não mostra chave 'desligada' nem formulário vazio quando a leitura falha", () => {
  const pagina = ler("../../app/(dashboard)/admin/sistema/page.tsx");
  assert.match(pagina, /const \{ data, error \} = admin \? await admin\.from\("chaves_plataforma"\)/);
  // O erro sobe ANTES de montar o painel do SMS e o formulário do parceiro geral.
  const lanca = pagina.indexOf("if (error) throw new Error");
  assert.ok(lanca > 0);
  assert.ok(lanca < pagina.indexOf("<ChaveSmsPainel") && lanca < pagina.indexOf("<ParceiroGeralForm"));
  assert.match(ler("../../app/(dashboard)/admin/error.tsx"), /Tentar de novo/);
});
