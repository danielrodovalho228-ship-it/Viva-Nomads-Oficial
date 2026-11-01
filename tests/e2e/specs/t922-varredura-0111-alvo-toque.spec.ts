import { test, expect, type Page, type Locator } from "@playwright/test";
import { NO_LABORATORIO } from "../fixtures/laboratorio";

/*
  T922 — #2004 (Pista A, varredura 01/11): links de texto soltos ganharam área de toque de 44 px (classe `alvo-toque`:
  um ::after absoluto de 44 px de altura, centrado no texto) — SÓ em tela de toque (@media (pointer: coarse), o desenho
  do #2004: o visual não muda). Na tela de verdade, como visitante:
   - celular com toque (390 px, isMobile + hasTouch): o ::after do link tem 44 px e posição absoluta, e um toque 18 px
     acima e 18 px abaixo do centro do texto (fora da linha, dentro dos 44 px) ainda cai NO link
     (document.elementFromPoint), ou seja, o alvo cresceu de verdade;
   - computador com mouse (1280 px): sem ::after (nada muda no visual nem no alvo);
  em três telas públicas do PR: a lista de parceiros ("Ser avaliador credenciado"), a página da cidade e a do polo
  (o "Início" da trilha de navegação).
*/
const SAIDA = "tests/laboratorio/saida";

async function medir(link: Locator) {
  return link.evaluate((a) => {
    const depois = getComputedStyle(a, "::after");
    const r = a.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const cai = (y: number) => {
      const el = document.elementFromPoint(cx, y);
      return !!el && (el === a || a.contains(el));
    };
    return { conteudo: depois.content, altura: depois.height, posicao: depois.position, alturaTexto: Math.round(r.height), acima: cai(cy - 18), abaixo: cai(cy + 18) };
  });
}

async function conferirAlvo(page: Page, link: Locator, nome: string, largura: number) {
  await link.scrollIntoViewIfNeeded();
  await expect(link).toBeVisible({ timeout: 30_000 });
  const m = await medir(link);
  console.log(`t922|${nome}|${largura}|${JSON.stringify(m)}`);
  if (largura === 390) {
    expect(m.altura, `${nome}: ::after de 44 px no toque`).toBe("44px");
    expect(m.posicao, `${nome}: ::after absoluto`).toBe("absolute");
    expect(m.alturaTexto, `${nome}: o texto em si é mais baixo que 44 px (o alvo é o ::after)`).toBeLessThan(44);
    expect(m.acima, `${nome}: toque 18 px acima do texto cai no link`).toBe(true);
    expect(m.abaixo, `${nome}: toque 18 px abaixo do texto cai no link`).toBe(true);
  } else {
    expect(m.conteudo, `${nome}: com mouse, sem ::after (o visual não muda)`).toBe("none");
  }
}

const TELAS = [
  { rota: "/parceiros", nome: "Parceiros › Ser avaliador credenciado", link: (p: Page) => p.getByRole("link", { name: "Ser avaliador credenciado" }) },
  { rota: "/cidades/uberlandia", nome: "Cidade › Início (trilha)", link: (p: Page) => p.locator("a.alvo-toque", { hasText: /^Início$/ }).first() },
  { rota: "/cidades/uberlandia/centro", nome: "Polo › Início (trilha)", link: (p: Page) => p.locator("a.alvo-toque", { hasText: /^Início$/ }).first() },
];

for (const t of TELAS) {
  for (const largura of [390, 1280] as const) {
    test(`T922 — ${t.nome} @${largura}: área de toque de 44 px`, async ({ browser }) => {
      const toque = largura === 390;
      const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] }, viewport: { width: largura, height: toque ? 844 : 900 }, isMobile: toque, hasTouch: toque });
      const page = await ctx.newPage();
      const r = await page.goto(t.rota, { waitUntil: "domcontentloaded" });
      test.skip(!NO_LABORATORIO && r?.status() === 404, `${t.rota} sem dados neste ambiente`);
      expect(r?.status() ?? 0).toBeLessThan(400);
      await conferirAlvo(page, t.link(page), t.nome, largura);
      await page.screenshot({ path: `${SAIDA}/t922-${t.rota.replace(/\//g, "-").slice(1)}-${largura}.png` });
      await ctx.close();
    });
  }
}
