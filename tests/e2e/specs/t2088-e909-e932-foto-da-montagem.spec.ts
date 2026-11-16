import { test, expect, type Locator } from "@playwright/test";

/*
  T2088 — E909 + E932 (Pista 3; auditoria da Família 4, ronda 06:55Z) @E909 @E932 @ao-vivo-seguro
  Regra decidida (Família 4; fora do #3883 por falta da foto — Dúvida 1 dele): a categoria Montagem tem a SUA foto, a
  mesma nos três usos públicos — o herói da porta /parceiros/buscar?categoria=montagem, o estado vazio dessa busca e o
  cartão da categoria (faixa de categorias da busca e cartão do formulário "Seja parceiro" de /parceiros). Hoje usa a
  foto provisória dos carregadores com a poltrona (/images/unicas/parceiros-mobilia.webp), que é a do cartão "Montagem
  e mudança" e não mostra montagem.
  A spec exige: a foto da Montagem não é a provisória nem a de outra categoria, e é a mesma nos usos que aparecem.
  Trava: vermelha na main até a foto entrar (proposta do Code 2: public/images/parceiros-categorias/montagem.webp).
  Visitante, só leitura.
*/
test.use({ storageState: { cookies: [], origins: [] } });

const PROVISORIA = "/images/unicas/parceiros-mobilia.webp";
const OUTRAS = ["mudanca", "limpeza", "lavanderia", "manutencao"].map((c) => `/images/parceiros-categorias/${c}.webp`).concat("/images/unicas/parceiros-fotografos.webp");

/** O arquivo da imagem (o next/image serve /_next/image?url=<arquivo>). */
async function arquivo(img: Locator): Promise<string> {
  await expect(img).toBeAttached({ timeout: 30_000 });
  const src = (await img.getAttribute("src")) ?? "";
  const u = new URL(src, "http://x");
  return u.pathname === "/_next/image" ? decodeURIComponent(u.searchParams.get("url") ?? "") : u.pathname;
}

function propria(nome: string, uso: string) {
  expect(nome, `${uso}: ainda a foto provisória dos carregadores`).not.toBe(PROVISORIA);
  expect(OUTRAS, `${uso}: a foto é de outra categoria (${nome})`).not.toContain(nome);
}

test("T2088 — E909/E932: a porta de busca da Montagem abre com a foto própria da categoria, a mesma da faixa e do estado vazio @E909 @E932 @ao-vivo-seguro", async ({ page }) => {
  const r = await page.goto("/parceiros/buscar?categoria=montagem", { waitUntil: "domcontentloaded" });
  expect(r?.status()).toBe(200);
  const heroi = await arquivo(page.getByTestId("banner-topo").locator("img").first());
  propria(heroi, "herói da porta");
  const faixa = page.getByTestId("faixa-categoria-montagem").locator("img").first();
  if (await faixa.count()) expect(await arquivo(faixa), "o cartão da faixa usa a mesma foto do herói").toBe(heroi);
  const vazio = page.getByTestId("busca-parceiros-vazia-foto").locator("img").first();
  if (await vazio.count()) expect(await arquivo(vazio), "o estado vazio usa a mesma foto do herói").toBe(heroi);
});

test("T2088 — E909/E932: o cartão Montagem do formulário de /parceiros usa a foto própria da categoria @E909 @E932 @ao-vivo-seguro", async ({ page }) => {
  const r = await page.goto("/parceiros", { waitUntil: "domcontentloaded" });
  expect(r?.status()).toBe(200);
  propria(await arquivo(page.getByTestId("sp-cat-cartao-montagem").locator("img").first()), "cartão do formulário");
});
