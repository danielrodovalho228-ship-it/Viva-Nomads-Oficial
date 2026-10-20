import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CAPAS } from "../components/dashboard/capas.ts";

// Ordem 75553f0a (laboratório verde): specs não fixam mais o que o produto mudou.
const raiz = process.cwd();
const spec = (nome: string) => readFileSync(join(raiz, "tests/e2e/specs", nome), "utf8");

test("t86 confere o alt da capa do painel, que existe em CAPAS.imoveis", () => {
  assert.match(CAPAS.imoveis.alt, /sala mobiliada/i);
  assert.doesNotMatch(CAPAS.imoveis.alt, /apartamento mobiliado/i);
  const t86 = spec("t86-decisao-avatar-alt.spec.ts");
  assert.match(t86, /painel-capa/);
  assert.doesNotMatch(t86, /getByAltText\("Sala de imóvel mobiliado preparada/);
});

test("t140/t141 não fixam o total de fotos do anúncio de exemplo", () => {
  for (const nome of ["t140-galeria-lightbox.spec.ts", "t141-galeria-1536.spec.ts"]) {
    const s = spec(nome);
    assert.doesNotMatch(s, /const TOTAL = \d+/, nome);
    assert.match(s, /posicao\(/, nome);
  }
});

test("t100 aceita ids de anúncio de exemplo (ube-001) na URL de comparar", () => {
  assert.doesNotMatch(spec("t100-comparar-imoveis.spec.ts"), /\[0-9a-f-\]\{36\}/);
});

test("t161: o título com o total do mês casa com o espaço fixo que o formatBRL devolve", async () => {
  const { formatBRL } = await import("./utils.ts");
  const titulo = `Imóvel mobiliado no Santa Mônica — ${formatBRL(3960)}/mês total · Viva Nomads`;
  const m = spec("t161-coerencia-imovel.spec.ts").match(/toHaveTitle\((\/.+\/)\)/);
  assert.ok(m, "o spec confere o título");
  const re = new RegExp(m[1].slice(1, -1));
  assert.match(titulo, re);
});

test("t150 espera a lista da busca assentar antes de medir o último cartão (lab: 25030 px)", () => {
  const t150 = spec("t150-comparar-acima-abas.spec.ts");
  assert.match(t150, /expect\s*\n?\s*\.poll\(/);
  assert.doesNotMatch(t150, /expect\(ultimo\)/);
});

test("t61 não usa getByRole('alert') puro: o anunciador de rota do Next também é role=alert (strict mode)", () => {
  const s = spec("t61-2fa-codigos-recuperacao.spec.ts");
  assert.doesNotMatch(s, /getByRole\("alert"\)/);
  assert.match(s, /locator\('p\[role="alert"\]'\)/);
});

test("t140 cobre 2560 px no elementFromPoint e o deslizar do lightbox a 390 px (ordem d1b76e6b, retorno 6814143d)", () => {
  const s = spec("t140-galeria-lightbox.spec.ts");
  assert.match(s, /\[1280, 1920, 2560\]/);
  assert.match(s, /Input\.dispatchTouchEvent/);
  assert.match(s, /hasTouch: true/);
});

test("t150 marca no máximo MAX_COMPARAR cartões: o 4º check não muda o estado (lab 3c9bd126)", () => {
  const t150 = spec("t150-comparar-acima-abas.spec.ts");
  assert.match(t150, /import \{ MAX_COMPARAR \} from/);
  assert.match(t150, /Math\.min\(await marcas\.count\(\), MAX_COMPARAR\)/);
  assert.doesNotMatch(t150, /Math\.min\(await marcas\.count\(\), \d+\)/);
});

test("t59 mede o último card do painel com poll, rolando ao fim a cada tentativa (instável no lab 3c9bd126)", () => {
  const t59 = spec("t59-flutuante-nao-tampa.spec.ts");
  assert.match(t59, /expect\s*\n?\s*\.poll\(cobre/);
  assert.doesNotMatch(t59, /expect\(cobre, "o flutuante cobre o último card"\)/);
});

test("t172 repete o clique da gaveta até a janela abrir (clique antes da hidratação, instável no lab 3c9bd126)", () => {
  const t172 = spec("t172-bom-saber-completo.spec.ts");
  assert.match(t172, /\.toPass\(\{ timeout: 20_000 \}\)/);
});
