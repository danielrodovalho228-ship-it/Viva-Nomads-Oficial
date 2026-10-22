/*
  Estático (laboratório verde, faixa D, lab bcb8d37c): três specs que falhavam por causa do próprio spec.
  - t6: a taxa do contrato hoje aparece como "12% sobre o valor mensal × meses (…)" (rotuloBaseTaxa), não "do valor total".
  - t129: os dois tamanhos de tela mexem na MESMA conta; em paralelo um restaurava o motivo enquanto o outro lia.
  - t91: a resposta entra na página do anúncio só após o cache de 60 s; a espera tem de caber folgada nisso.
*/
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const raiz = new URL("../../", import.meta.url).pathname;
const ler = (p: string) => readFileSync(join(raiz, p), "utf8");

test("t6 aceita o rótulo atual da taxa (valor mensal × meses)", () => {
  const spec = ler("tests/e2e/specs/t6-dinheiro-numeros.spec.ts");
  const base = ler("src/lib/taxa-servico-base.ts");
  assert.match(base, /sobre o valor mensal × meses/);
  assert.match(spec, /sobre o valor mensal × meses/);
});

test("t129 roda em série (mesma conta nos dois tamanhos de tela)", () => {
  const spec = ler("tests/e2e/specs/t129-motivo-estadia-perfil.spec.ts");
  assert.match(spec, /test\.describe\.configure\(\{\s*mode:\s*"serial"\s*\}\)/);
});

test("t91 espera a resposta além do cache de 60 s", () => {
  const spec = ler("tests/e2e/specs/t91-avaliacao-resposta.spec.ts");
  const m = spec.match(/\.toPass\(\{[^}]*timeout:\s*([\d_]+)/);
  assert.ok(m, "toPass com timeout");
  assert.ok(Number(m[1].replace(/_/g, "")) >= 110_000);
});

test("t17 e t43 usam o único aviso que a Conta tem (e-mail); WhatsApp saiu na ordem p30 item 8", () => {
  const tela = ler("src/components/account/conta-secoes.tsx");
  assert.match(tela, /label: "Avisos por e-mail"/);
  assert.doesNotMatch(tela, /Avisos por WhatsApp/);
  for (const f of ["t17-conta-salvar", "t43-notificacoes"]) {
    const spec = ler(`tests/e2e/specs/${f}.spec.ts`);
    assert.match(spec, /name: "Avisos por e-mail"/);
    assert.doesNotMatch(spec, /toBeVisible\(\)[^\n]*\n?.*Avisos por WhatsApp|getByText\("Avisos por WhatsApp"\)\)\.toBeVisible|name: "Avisos por WhatsApp"/);
  }
});

test("t3: /pedidos/novo é página pública (fora da casca), como /buscar", () => {
  const menu = ler("src/config/menu-por-papel.ts");
  assert.match(menu, /href: "\/pedidos\/novo"/);
  const spec = ler("tests/e2e/specs/t3-isolamento-papeis.spec.ts");
  assert.match(spec, /filter\(\(h\) => !PUBLICAS_FORA_DA_CASCA\.includes\(h\)\)/);
  assert.match(spec, /PUBLICAS_FORA_DA_CASCA = \[[^\]]*"\/pedidos\/novo"/);
});

test("t209 compara o assunto sem o sufixo '· Viva Nomads' que o envio acrescenta", () => {
  const assuntos = ler("src/lib/notifications/assuntos.ts");
  assert.match(assuntos, /SUFIXO_ASSUNTO = " · Viva Nomads"/);
  const spec = ler("tests/e2e/specs/t209-jornada-dois-lados.spec.ts");
  assert.match(spec, /\.map\(\(r\) => r\.assunto\.replace\(\/ · Viva Nomads\$\/, ""\)\)/);
});

test("t71 centraliza o grupo busca + 'Publicar pedido' no slot do cabeçalho, não só a pílula", () => {
  const spec = ler("tests/e2e/specs/t71-busca-topo.spec.ts");
  assert.match(spec, /compacta\.locator\("xpath=\.\."\)\.boundingBox\(\)/);
  assert.doesNotMatch(spec, /cBox\.x \+ cBox\.width \/ 2 - \(sBoxSlot/);
});

test("t6 entra de novo se a sessão salva do proprietário cair no login e usa o rótulo atual no pulo", () => {
  const spec = ler("tests/e2e/specs/t6-dinheiro-numeros.spec.ts");
  assert.match(spec, /loginAs\(page, "proprietario"\)/);
  assert.match(spec, /not\.toHaveURL\(\/\\\/auth\/\)/);
  assert.doesNotMatch(spec, /Taxa de serviço do contrato/);
  assert.match(ler("src/app/(dashboard)/dashboard/contratos/contratos-client.tsx"), /Taxa de serviço:\{" "\}/);
});

test("t70: todos os testes da busca dividida têm prazo de 120 s (servidor frio do lab 75f265dd)", () => {
  const spec = ler("tests/e2e/specs/t70-busca-split.spec.ts");
  assert.match(spec, /test\.describe\.configure\(\{\s*timeout:\s*120_000\s*\}\)/);
});

test("t160 confere a grade pelos cartões da própria tela, sem cruzar com outra leitura da API", () => {
  const spec = ler("tests/e2e/specs/t160-favoritos-pagina.spec.ts");
  assert.match(spec, /aria-busy", "false"/);
  assert.doesNotMatch(spec, /request\.get\("\/api\/properties"\)/);
  assert.match(spec, /toHaveCount\(antes - 1\)/);
  assert.doesNotMatch(spec, /toHaveCount\(2\);\n\n\s*await page\.getByRole\("button", \{ name: "Remover dos favoritos" \}\)\.first/);
});

test("t93 diz se a resposta foi gravada no banco antes de cobrar a tela", () => {
  const spec = ler("tests/e2e/specs/t93-avaliacao-tela.spec.ts");
  assert.match(spec, /from\("avaliacao_respostas"\)/);
  assert.match(spec, /NÃO gravada no banco/);
});

test("t235 dá tempo à 1ª imagem do cartão gerada a frio no lab", () => {
  const spec = ler("tests/e2e/specs/t235-cartoes-compartilhaveis.spec.ts");
  assert.match(spec, /naturalWidth\), \{ timeout: 45_000 \}/);
  assert.match(spec, /naturalHeight\), \{ timeout: 45_000 \}/);
  assert.match(spec, /1\. dono[\s\S]{0,260}test\.setTimeout\(240_000\)/);
});

test("t117, t125, t143 e t152 têm janela de 120 s nos testes de várias navegações (lab 3084c6f3: 45 s esgotados)", () => {
  for (const f of ["t117-polos-cidade", "t125-alerta-busca-salva", "t143-custo-total-mes", "t152-barra-fixa-imovel"]) {
    const spec = ler(`tests/e2e/specs/${f}.spec.ts`);
    const m = spec.match(/test\.setTimeout\(([\d_]+)\)/g) ?? [];
    assert.ok(m.length >= 1, `${f}: test.setTimeout`);
    for (const x of m) assert.ok(Number(x.match(/[\d_]+/)![0].replace(/_/g, "")) >= 120_000);
  }
  assert.equal((ler("tests/e2e/specs/t152-barra-fixa-imovel.spec.ts").match(/test\.setTimeout/g) ?? []).length, 3);
});

test("t193 repete o clique de contrapropor até a ajuda do valor aparecer (clique antes da hidratação)", () => {
  const spec = ler("tests/e2e/specs/t193-propostas.spec.ts");
  assert.match(spec, /toPass\(\{ timeout: 30_000 \}\)/);
  assert.match(spec, /count\(\)\) === 0\) await b\.getByTestId\("proposta-contrapropor"\)\.click\(\)/);
});
