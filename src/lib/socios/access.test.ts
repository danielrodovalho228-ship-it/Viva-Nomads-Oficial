/*
  Código do investidor: próprio, só o /simulacao, revogável sem mexer no dos sócios.
  Roda: node --test src/lib/socios/access.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { acessoInterno, investidorToken, isInternalPath, sociosToken } from "./access.ts";

process.env.SOCIOS_ACCESS_CODE = "codigo-socios-teste";
process.env.INVESTIDOR_ACCESS_CODE = "codigo-investidor-teste";

test("investidor abre só o /simulacao; /roi, /decisao, /tributario, /modelodenegocio e /socios ficam fechados", async () => {
  const investidor = await investidorToken("codigo-investidor-teste");
  assert.equal(await acessoInterno("/simulacao", { investidor }), "investidor");
  for (const p of ["/roi", "/decisao", "/tributario", "/modelodenegocio", "/socios"]) {
    assert.ok(isInternalPath(p));
    assert.equal(await acessoInterno(p, { investidor }), null, p);
  }
});

test("sócio abre todas; um cookie nunca vale pelo outro", async () => {
  const socio = await sociosToken("codigo-socios-teste");
  assert.equal(await acessoInterno("/roi", { socio }), "socio");
  assert.equal(await acessoInterno("/simulacao", { socio }), "socio");
  // token do investidor no lugar do de sócio (e vice-versa) não libera
  assert.equal(await acessoInterno("/roi", { socio: await investidorToken("codigo-investidor-teste") }), null);
  assert.equal(await acessoInterno("/simulacao", { investidor: await sociosToken("codigo-socios-teste") }), null);
});

test("trocar ou apagar o código do investidor derruba o acesso dele, sem afetar o dos sócios", async () => {
  const antigo = await investidorToken("codigo-investidor-teste");
  process.env.INVESTIDOR_ACCESS_CODE = "novo-codigo";
  assert.equal(await acessoInterno("/simulacao", { investidor: antigo }), null);
  delete process.env.INVESTIDOR_ACCESS_CODE;
  assert.equal(await acessoInterno("/simulacao", { investidor: antigo }), null);
  assert.equal(await acessoInterno("/roi", { socio: await sociosToken("codigo-socios-teste") }), "socio");
  process.env.INVESTIDOR_ACCESS_CODE = "codigo-investidor-teste";
});

test("página e proxy usam a mesma regra; investidor sem o menu das internas e em modo leitura", () => {
  const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
  assert.match(ler("proxy.ts"), /acessoInterno\(pathname/);
  assert.match(ler("lib/socios/guard.ts"), /acessoInterno\(pathname/);
  const pagina = ler("app/simulacao/page.tsx");
  assert.match(pagina, /!investidor && <PaginasInternasNav/);
  assert.match(pagina, /leitura=\{investidor\}/);
  assert.match(ler("app/acesso-socios/actions.ts"), /redirect\(INVESTIDOR_PAGES\[0\]\)/);
  // A simulação não lê dados de usuários: só premissas.
  assert.doesNotMatch(ler("components/financeiro/modelo-financeiro.tsx"), /supabase|createClient|from\("/);
});
