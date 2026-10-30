import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { abrirPasso, prepararRascunho } from "../fixtures/rascunho-cadastro";

/*
  T710 — E265 (PR #1602): nenhum cartão com foto leva mais o selo "Imagem ilustrativa" — o que a t704 (Passo 1 de conta
  nova) e a t325 (contagem nas duas páginas) não percorrem:
   1. Cartão a cartão (1280 e 390): as 7 fotos de seção de /empresas (3) e /para-proprietarios (4), cada uma achada pelo
      alt do cartão, carregam de verdade, ficam no topo do cartão e a moldura da foto só tem a imagem (nenhum texto,
      nenhum elemento a mais); o título do cartão fica abaixo da foto.
   2. Varredura das páginas públicas com fotos (/, /como-funciona, /buscar, /empresas, /para-proprietarios e o anúncio
      de exemplo), 1280 e 390: zero selo-ilustrativa e zero "Imagem ilustrativa"; as imagens visíveis carregam. O que
      DEVE ficar fica: o selo "Exemplo ilustrativo" do anúncio de exemplo (não é foto de cartão).
   3. Passo 1 a partir de um rascunho com tipo escolhido (laboratório, 1280 e 390): o cartão marcado mostra o visto,
      todos os rótulos são só o nome do tipo (sem resto de selo), a foto do marcado carrega e a moldura não tem texto;
      trocar o tipo move o visto sem aparecer texto sobre as fotos.
*/
const SAIDA = "tests/laboratorio/saida";
const LARGURAS = [1280, 390] as const;
const viewport = (w: number) => ({ width: w, height: w === 390 ? 844 : 900 });

/** Alts de src/lib/cartoes-secao.ts (as 7 fotos de seção, todas `ilustrativa: true` nos dados). */
const CARTOES = {
  "/empresas": [
    "Profissional chegando a um imóvel mobiliado com mala de viagem",
    "Mesa de trabalho com notebook e recibo impresso",
    "Tela de notebook com gráficos sobre uma mesa de escritório",
  ],
  "/para-proprietarios": [
    "Contas de casa organizadas sobre uma mesa ao lado de uma planta",
    "Sala mobiliada e arrumada, pronta para receber o morador",
    "Pessoa assinando um documento no celular",
    "Chaves de um imóvel sobre um documento dobrado",
  ],
} as const;

const ROTULOS = ["Casa", "Apartamento", "Quarto", "Studio", "Loft", "Cobertura", "Casa de condomínio", "Flat/apart-hotel", "Chácara/Sítio"];

async function semSelo(p: Page) {
  await expect(p.getByTestId("selo-ilustrativa")).toHaveCount(0);
  await expect(p.getByText("Imagem ilustrativa", { exact: true })).toHaveCount(0);
  expect(await p.evaluate(() => document.body.innerText.includes("Imagem ilustrativa")), "texto 'Imagem ilustrativa' na página").toBe(false);
}

test.describe("T710 — E265: nenhum cartão com foto leva o selo 'Imagem ilustrativa'", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 });

  for (const largura of LARGURAS) {
    for (const [rota, alts] of Object.entries(CARTOES)) {
      test(`1. ${rota} a ${largura} px: cada foto de seção carrega, no topo do cartão, com a moldura só com a imagem`, async ({ browser }) => {
        const ctx = await browser.newContext({ viewport: viewport(largura), storageState: { cookies: [], origins: [] } });
        const p = await ctx.newPage();
        await p.goto(rota, { waitUntil: "domcontentloaded" });
        await expect(p.getByTestId("cartao-foto-pendente")).toHaveCount(0);
        for (const alt of alts) {
          const img = p.getByRole("img", { name: alt, exact: true }).first();
          await img.scrollIntoViewIfNeeded({ timeout: 20_000 });
          await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0), { timeout: 15_000 }).toBe(true);
          // img → BrandImage → FotoCartao → cartão.
          const m = await img.evaluate((el) => {
            const moldura = el.parentElement!.parentElement!;
            const cartao = moldura.parentElement!;
            const ri = el.getBoundingClientRect();
            const rc = cartao.getBoundingClientRect();
            const titulo = cartao.querySelector("h3")?.getBoundingClientRect();
            return {
              textoMoldura: (moldura.textContent ?? "").trim(),
              filhosMoldura: moldura.childElementCount,
              spansMoldura: moldura.querySelectorAll("span").length,
              topoFoto: ri.top - rc.top,
              tituloAbaixo: titulo ? titulo.top - ri.bottom : null,
              larguraFoto: ri.width,
              larguraCartao: rc.width,
            };
          });
          expect(m.textoMoldura, `${alt}: texto sobre a foto`).toBe("");
          expect(m.filhosMoldura, `${alt}: a moldura só tem a imagem`).toBe(1);
          expect(m.spansMoldura, `${alt}: nada de selo (span) na moldura`).toBe(0);
          expect(Math.abs(m.topoFoto), `${alt}: foto no topo do cartão`).toBeLessThanOrEqual(2);
          expect(m.larguraFoto, `${alt}: foto na largura do cartão`).toBeGreaterThanOrEqual(m.larguraCartao - 4);
          expect(m.tituloAbaixo, `${alt}: título abaixo da foto`).not.toBeNull();
          expect(m.tituloAbaixo!).toBeGreaterThanOrEqual(0);
        }
        await semSelo(p);
        const sobra = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(sobra).toBeLessThanOrEqual(1);
        await p.getByRole("img", { name: alts[0], exact: true }).first().scrollIntoViewIfNeeded();
        await p.screenshot({ path: `${SAIDA}/t710-cartoes${rota.replace("/", "-")}-${largura}.png` });
        await ctx.close();
      });
    }
  }

  // `fotos`: confere que as imagens carregam. Fica de fora onde aparecem anúncios do laboratório (home e busca), cujas
  // fotos apontam para um host fictício (lab.vivanomads.test) e não carregam de propósito.
  const VARREDURA = [
    { rota: "/", fotos: false },
    { rota: "/como-funciona", fotos: true },
    { rota: "/buscar", fotos: false },
    { rota: "/empresas", fotos: true },
    { rota: "/para-proprietarios", fotos: true },
    { rota: "/imoveis/ube-001", fotos: true },
  ] as const;
  for (const largura of LARGURAS) {
    test(`2. ${largura} px: varredura das páginas públicas — nenhum selo, imagens visíveis carregadas; "Exemplo ilustrativo" fica`, async ({ browser }) => {
      test.setTimeout(180_000);
      const ctx = await browser.newContext({ viewport: viewport(largura), storageState: { cookies: [], origins: [] } });
      const p = await ctx.newPage();
      for (const { rota, fotos } of VARREDURA) {
        await p.goto(rota, { waitUntil: "domcontentloaded" });
        await p.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
        // Desce a página toda para as imagens preguiçosas entrarem.
        await p.evaluate(async () => {
          for (let y = 0; y < document.body.scrollHeight; y += Math.round(window.innerHeight * 0.8)) {
            window.scrollTo(0, y);
            await new Promise((r) => setTimeout(r, 120));
          }
          window.scrollTo(0, 0);
        });
        await semSelo(p);
        // O que se prova é que a foto carrega, não quando: as preguiçosas que a descida não chegou a pedir (a 390 a página
        // é longa e cada passo dura 120 ms) passam a "eager" — a 1ª rodada no lab (#1604) pegou 4 assim em /como-funciona.
        await p.evaluate(() => document.querySelectorAll('img[loading="lazy"]').forEach((i) => i.setAttribute("loading", "eager")));
        // Toda <img> do próprio site que está na página de fato (com caixa, dentro da largura) carregou.
        if (fotos) {
          await expect
            .poll(
              () =>
                p.evaluate(() =>
                  Array.from(document.images)
                    .filter((i) => {
                      const r = i.getBoundingClientRect();
                      const st = getComputedStyle(i);
                      const src = i.currentSrc || i.src;
                      const doSite = !!src && (src.startsWith("data:") || new URL(src, location.href).origin === location.origin);
                      return doSite && r.width > 1 && r.height > 1 && r.right > 0 && r.left < window.innerWidth && st.visibility !== "hidden";
                    })
                    .filter((i) => !(i.complete && i.naturalWidth > 0))
                    .map((i) => i.currentSrc || i.src),
                ),
              { timeout: 20_000, message: `${rota}: imagens sem carregar` },
            )
            .toEqual([]);
        }
        if (rota === "/imoveis/ube-001") {
          // O selo honesto do anúncio de exemplo continua (não é o selo de foto que o E265 tirou).
          await expect(p.getByTestId("selo-exemplo").first()).toHaveText("Exemplo ilustrativo", { timeout: 20_000 });
        }
      }
      await p.screenshot({ path: `${SAIDA}/t710-varredura-exemplo-${largura}.png` });
      await ctx.close();
    });
  }

  test.describe("3. Passo 1 a partir de rascunho", () => {
    test.describe.configure({ mode: "serial", timeout: 180_000 });
    const senha = novaSenha();
    const sufixo = novoSufixo();
    const dono = { email: `dono.t710.${sufixo}@lab.vivanomads.test`, nome: "Selma Semselo", role: "owner" as const };
    const ids: { dono?: string; rascunho: Record<number, string> } = { rascunho: {} };

    test.beforeAll(async () => {
      ids.dono = await criarConta(dono, senha);
      await adm().from("profiles").update({ is_teste: true }).eq("id", ids.dono);
      for (const l of LARGURAS) ids.rascunho[l] = await prepararRascunho(ids.dono, `Loft sem selo ${l} ${sufixo}`, { propertyType: "loft" });
    });
    test.afterAll(async () => {
      await apagarContas([ids.dono]);
    });

    for (const largura of LARGURAS) {
      test(`${largura} px: tipo marcado com visto, rótulos limpos, foto carregada e nada escrito sobre as fotos`, async ({ browser }) => {
        const p = await abrirPasso(browser, { email: dono.email, senha }, ids.rascunho[largura], "tipo", largura);
        const linha = p.getByRole("radiogroup", { name: "Tipo do imóvel" });
        await expect(linha).toBeVisible({ timeout: 30_000 });
        const cartoes = linha.getByRole("radio");
        await expect(cartoes).toHaveCount(9);
        // Rótulo = só o nome do tipo (antes o texto do cartão vinha com "Imagem ilustrativa" junto).
        expect((await cartoes.allTextContents()).map((t) => t.trim())).toEqual(ROTULOS);
        const loft = p.getByTestId("tipo-loft");
        await expect(loft).toHaveAttribute("aria-checked", "true", { timeout: 20_000 });
        await expect(loft.getByTestId("tipo-marcado")).toHaveCount(1);
        await expect(p.getByTestId("tipo-marcado")).toHaveCount(1);
        const foto = p.getByTestId("tipo-loft-foto");
        await foto.scrollIntoViewIfNeeded();
        await expect.poll(() => foto.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0), { timeout: 15_000 }).toBe(true);
        await expect(foto).toHaveAttribute("alt", "Foto ilustrativa de um loft");
        const molduras = () => linha.locator("img").evaluateAll((els) => els.map((e) => ({ texto: (e.parentElement?.textContent ?? "").trim(), filhos: e.parentElement?.childElementCount ?? -1 })));
        expect(await molduras()).toEqual(Array.from({ length: 9 }, () => ({ texto: "", filhos: 1 })));
        await p.screenshot({ path: `${SAIDA}/t710-passo1-marcado-${largura}.png` });

        // Trocar o tipo move o visto; nenhuma moldura ganha texto.
        const casa = p.getByTestId("tipo-casa");
        await casa.scrollIntoViewIfNeeded();
        await casa.click();
        await expect(casa).toHaveAttribute("aria-checked", "true");
        await expect(loft).toHaveAttribute("aria-checked", "false");
        await expect(casa.getByTestId("tipo-marcado")).toHaveCount(1);
        await expect(p.getByTestId("tipo-marcado")).toHaveCount(1);
        expect(await molduras()).toEqual(Array.from({ length: 9 }, () => ({ texto: "", filhos: 1 })));
        await semSelo(p);
        await p.context().close();
      });
    }
  });
});
